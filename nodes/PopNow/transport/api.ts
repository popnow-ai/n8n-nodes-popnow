import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

import { CREDENTIAL_NAME, DEFAULT_BASE_URL, USER_AGENT } from '../shared/constants';
import { sha256Hex } from '../shared/idempotency';

export type ApiContext = IExecuteFunctions | ILoadOptionsFunctions;

const RETRYABLE_HTTP = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set([429, 500, 50301]);
// 50302 rides on a 503, but resending under the same Idempotency-Key only replays the recorded
// failure, so it is checked before the status code.
const NON_RETRYABLE_CODES = new Set([50302]);
const MAX_RETRIES = 3;

const REQUEST_TIMEOUT_MS = 60_000;
const UPLOAD_TIMEOUT_MS = 600_000;
const DOWNLOAD_TIMEOUT_MS = 900_000;

/**
 * What to do about a business code. Branch on the code, never on the message: messages follow
 * the account's API error language, codes never change.
 */
export const RECOVERY_BY_CODE: Record<number, string> = {
	401: 'Check the API key in the PopNow credential. Keys are managed at https://popnow.ai/api/console/keys.',
	402: 'The account does not have enough credits for this request. Buy credits at https://popnow.ai/pricing, then run the node again.',
	40201:
		'The account does not have enough credits for this request. Buy credits at https://popnow.ai/pricing, then run the node again.',
	40202:
		'This API key reached its spend cap. Raise the cap for the key in the PopNow API console, or wait for it to reset.',
	40003:
		'The uploaded file did not match its upload ticket. Run the node again to upload it again.',
	40004:
		'No deployment serves this parameter combination. Change the parameter named in the message, or pick another model.',
	40301:
		'This API key is not allowed to call this model. Add the model to the key in the PopNow API console.',
	40302:
		"The request came from an address outside this API key's IP allow-list. Add the address in the PopNow API console.",
	40310:
		'Your PopNow account has not verified its email address yet. Open the verification link sent at sign-up, then run the node again.',
	409: 'This item was already submitted in this execution with a different request (for example, an input file was uploaded again), or by another API key. Nothing new was charged.',
	40901:
		'The price changed before the task was created. Run the node again to accept the new price.',
	429: 'Too many requests. Wait a moment and run the node again.',
	50301: 'This model has no usable deployment right now. Try again later or pick another model.',
	50302: 'The generation failed and was refunded. Run the node again.',
};

export interface ApiCallOptions {
	qs?: IDataObject;
	body?: IDataObject;
	headers?: IDataObject;
	timeoutMs?: number;
	/** Resend on network errors, 408/429/5xx and retryable business codes. Default true. */
	retry?: boolean;
	/** createTask only: one of the three 409 answers is a transient race worth a single resend. */
	retryConflictOnce?: boolean;
}

export interface ApiResult {
	ok: boolean;
	status: number;
	code?: number;
	message: string;
	requestId: string;
	data: IDataObject;
	headers: IDataObject;
}

interface FullResponse {
	statusCode: number;
	headers: IDataObject;
	body: unknown;
}

function isObject(value: unknown): value is IDataObject {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function cancelSignal(context: ApiContext): AbortSignal | undefined {
	if (
		'getExecutionCancelSignal' in context &&
		typeof context.getExecutionCancelSignal === 'function'
	) {
		return context.getExecutionCancelSignal();
	}
	return undefined;
}

/**
 * Sleep in one-second slices so a stopped execution notices within a second.
 * Returns false when the execution was stopped while waiting.
 */
export async function cancellableSleep(context: ApiContext, ms: number): Promise<boolean> {
	const signal = cancelSignal(context);
	let remaining = Math.max(0, ms);
	while (remaining > 0) {
		if (signal?.aborted) {
			return false;
		}
		const step = Math.min(1000, remaining);
		await sleep(step);
		remaining -= step;
	}
	return !signal?.aborted;
}

function retryDelayMs(attempt: number, retryAfterSeconds?: number): number {
	const exponential = Math.min(500 * 2 ** attempt, 8000) * (0.8 + Math.random() * 0.4);
	return Math.max(exponential, (retryAfterSeconds ?? 0) * 1000);
}

function retryAfterOf(headers: IDataObject): number | undefined {
	const raw = headers['retry-after'];
	const value = Number(Array.isArray(raw) ? raw[0] : raw);
	return Number.isFinite(value) && value >= 0 ? Math.min(value, 60) : undefined;
}

function headerValue(headers: IDataObject, name: string): string {
	const raw = headers[name.toLowerCase()];
	if (Array.isArray(raw)) {
		return raw.map(String).join(', ');
	}
	return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
}

export async function resolveBaseUrl(this: ApiContext): Promise<string> {
	const credentials = await this.getCredentials(CREDENTIAL_NAME);
	const configured = typeof credentials.baseUrl === 'string' ? credentials.baseUrl.trim() : '';
	return (configured || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/**
 * A short, non-reversible fingerprint of the account behind the credential, used only to keep
 * cached uploads from being shared between two credentials in the same n8n process.
 */
export async function accountFingerprint(this: ApiContext): Promise<string> {
	const credentials = await this.getCredentials(CREDENTIAL_NAME);
	const base = await resolveBaseUrl.call(this);
	return sha256Hex(`${base}\n${String(credentials.apiKey ?? '')}`).slice(0, 32);
}

/**
 * Call an endpoint that answers with the {code, msg, data, request_id} envelope. HTTP and
 * business failures come back as { ok: false }; only an unreachable API throws.
 */
export async function apiCall(
	this: ApiContext,
	method: IHttpRequestMethods,
	path: string,
	options: ApiCallOptions = {},
): Promise<ApiResult> {
	const base = await resolveBaseUrl.call(this);
	const retry = options.retry !== false;
	const signal = cancelSignal(this);
	let conflicts = 0;

	for (let attempt = 0; ; attempt++) {
		const request: IHttpRequestOptions = {
			method,
			url: `${base}${path}`,
			qs: options.qs,
			headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...options.headers },
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
			timeout: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
		};
		if (options.body !== undefined) {
			request.body = options.body;
		}
		if (signal) {
			request.abortSignal = signal;
		}

		let response: FullResponse | undefined;
		let failure: unknown;
		try {
			response = (await this.helpers.httpRequestWithAuthentication.call(
				this,
				CREDENTIAL_NAME,
				request,
			)) as FullResponse;
		} catch (error) {
			failure = error;
		}

		if (!response) {
			if (retry && attempt < MAX_RETRIES && !signal?.aborted) {
				if (await cancellableSleep(this, retryDelayMs(attempt))) {
					continue;
				}
			}
			throw new NodeApiError(this.getNode(), (failure ?? {}) as JsonObject, {
				message: 'Could not reach PopNow',
				description: `The request to ${base}${path} failed before an answer arrived. A proxy or firewall between n8n and the API may be blocking it.`,
			});
		}

		const status = Number(response.statusCode) || 0;
		const headers = isObject(response.headers) ? response.headers : {};
		let body = response.body;
		if (typeof body === 'string') {
			try {
				body = JSON.parse(body);
			} catch {
				body = undefined;
			}
		}
		const envelope = isObject(body) ? body : undefined;
		const code = typeof envelope?.code === 'number' ? envelope.code : undefined;
		const ok = status >= 200 && status < 300 && code === 200 && envelope !== undefined;

		if (!ok && retry && attempt < MAX_RETRIES && !signal?.aborted) {
			let resend = false;
			if (code === 409 && options.retryConflictOnce) {
				conflicts += 1;
				resend = conflicts <= 1;
			} else if (code === undefined || !NON_RETRYABLE_CODES.has(code)) {
				resend = RETRYABLE_HTTP.has(status) || (code !== undefined && RETRYABLE_CODES.has(code));
			}
			if (resend && (await cancellableSleep(this, retryDelayMs(attempt, retryAfterOf(headers))))) {
				continue;
			}
		}

		let message = typeof envelope?.msg === 'string' ? envelope.msg : '';
		if (!ok && !message) {
			message = envelope
				? `PopNow request failed with HTTP ${status}`
				: `PopNow answered HTTP ${status} with a body that is not JSON; a proxy between n8n and the API may be intercepting the request`;
		}
		return {
			ok,
			status,
			code,
			message,
			requestId:
				typeof envelope?.request_id === 'string'
					? envelope.request_id
					: headerValue(headers, 'x-request-id'),
			data: isObject(envelope?.data) ? envelope.data : {},
			headers,
		};
	}
}

/** Turn a failed call into the error n8n shows, with what to do about it. */
export function apiError(context: ApiContext, result: ApiResult, itemIndex?: number): NodeApiError {
	const recovery =
		(result.code !== undefined && RECOVERY_BY_CODE[result.code]) ||
		RECOVERY_BY_CODE[result.status] ||
		'';
	const parts = [
		recovery,
		`HTTP ${result.status}${result.code !== undefined ? `, code ${result.code}` : ''}.`,
	];
	if (result.requestId) {
		parts.push(`Request ID: ${result.requestId}.`);
	}
	const error = new NodeApiError(
		context.getNode(),
		{
			message: result.message,
			code: result.code ?? null,
			request_id: result.requestId,
		} as JsonObject,
		{
			message: result.message,
			description: parts.filter(Boolean).join(' '),
			httpCode: String(result.status),
			itemIndex,
		},
	);
	error.context.popNowCode = result.code;
	error.context.requestId = result.requestId;
	return error;
}

/** Like apiCall, but returns `data` and throws a descriptive error on failure. */
export async function apiRequest(
	this: ApiContext,
	method: IHttpRequestMethods,
	path: string,
	options: ApiCallOptions = {},
	itemIndex?: number,
): Promise<IDataObject> {
	const result = await apiCall.call(this, method, path, options);
	if (!result.ok) {
		throw apiError(this, result, itemIndex);
	}
	return result.data;
}

export function modelPath(modelId: string): string {
	return `/api/v1/models/${modelId
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/')}`;
}

// -- Files ------------------------------------------------------------------

/** PUT the bytes to a signed storage URL. No API key: the URL is its own credential. */
async function putToSignedUrl(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	url: string,
	headers: IDataObject,
	data: Buffer,
): Promise<number> {
	const response = (await this.helpers.httpRequest({
		method,
		url,
		body: data,
		headers,
		json: false,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		timeout: UPLOAD_TIMEOUT_MS,
	})) as FullResponse;
	return Number(response.statusCode) || 0;
}

/**
 * Upload ticket, PUT and commit. Returns the popnow:// URI that goes into a task's input.
 * The ticket is never retried: each one is a signed write authorisation against a tight
 * per-account limit, and a second ticket does not make the first one usable.
 */
export async function uploadFile(
	this: IExecuteFunctions,
	data: Buffer,
	contentType: string,
	itemIndex?: number,
): Promise<{ uri: string; fileId: string; expiresAt?: string }> {
	const ticket = await apiRequest.call(
		this,
		'POST',
		'/api/v1/common/upload-url',
		{ body: { contentType, bytes: data.length }, retry: false },
		itemIndex,
	);
	const maxBytes = typeof ticket.maxBytes === 'number' ? ticket.maxBytes : undefined;
	if (maxBytes !== undefined && data.length > maxBytes) {
		throw new NodeOperationError(
			this.getNode(),
			`The file is ${data.length} bytes, but PopNow accepts at most ${maxBytes} bytes for ${contentType}`,
			{ itemIndex },
		);
	}
	const uploadUrl = typeof ticket.uploadUrl === 'string' ? ticket.uploadUrl : '';
	const fileId = typeof ticket.fileId === 'string' ? ticket.fileId : '';
	if (!uploadUrl || !fileId) {
		throw new NodeOperationError(this.getNode(), 'PopNow returned an incomplete upload ticket', {
			itemIndex,
		});
	}
	// Every ticket header goes out exactly as received: Content-Type and Content-Length are part
	// of the signature.
	const putHeaders: IDataObject = {};
	if (isObject(ticket.headers)) {
		for (const [name, value] of Object.entries(ticket.headers)) {
			putHeaders[name] = String(value);
		}
	}
	const method = (
		typeof ticket.method === 'string' ? ticket.method.toUpperCase() : 'PUT'
	) as IHttpRequestMethods;
	const status = await putToSignedUrl.call(this, method, uploadUrl, putHeaders, data);
	if (status < 200 || status >= 300) {
		throw new NodeOperationError(this.getNode(), `Uploading the file failed with HTTP ${status}`, {
			itemIndex,
			description: 'Run the node again to upload it with a new ticket.',
		});
	}
	const committed = await apiRequest.call(
		this,
		'POST',
		`/api/v1/files/${encodeURIComponent(fileId)}/commit`,
		{},
		itemIndex,
	);
	const uri = typeof committed.uri === 'string' ? committed.uri : '';
	if (!uri) {
		throw new NodeOperationError(
			this.getNode(),
			'The upload was committed but no file URI came back',
			{
				itemIndex,
			},
		);
	}
	const expiresAt = typeof committed.expiresAt === 'string' ? committed.expiresAt : undefined;
	return { uri, fileId, expiresAt };
}

/** Fetch an output file. The signed URL is the credential; no API key is attached. */
export async function downloadFile(
	this: IExecuteFunctions,
	url: string,
	itemIndex?: number,
): Promise<{ data: Buffer; contentType: string }> {
	let lastStatus = 0;
	let lastFailure: unknown;
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		let response: FullResponse | undefined;
		try {
			response = (await this.helpers.httpRequest({
				method: 'GET',
				url,
				encoding: 'arraybuffer',
				json: false,
				returnFullResponse: true,
				ignoreHttpStatusErrors: true,
				timeout: DOWNLOAD_TIMEOUT_MS,
			})) as FullResponse;
		} catch (error) {
			lastFailure = error;
		}
		if (response) {
			lastStatus = Number(response.statusCode) || 0;
			if (lastStatus >= 200 && lastStatus < 300) {
				const body = response.body;
				const data = Buffer.isBuffer(body)
					? body
					: body instanceof ArrayBuffer
						? Buffer.from(body)
						: Buffer.from(body as Uint8Array);
				const headers = isObject(response.headers) ? response.headers : {};
				return { data, contentType: headerValue(headers, 'content-type') };
			}
			if (!RETRYABLE_HTTP.has(lastStatus)) {
				break;
			}
		}
		if (attempt < MAX_RETRIES && !(await cancellableSleep(this, retryDelayMs(attempt)))) {
			break;
		}
	}
	throw new NodeOperationError(
		this.getNode(),
		lastStatus
			? `Downloading the result failed with HTTP ${lastStatus}`
			: `Downloading the result failed: ${lastFailure instanceof Error ? lastFailure.message : 'network error'}`,
		{
			itemIndex,
			description:
				'Result links last about 20 minutes. Run Task > Get with this task ID to get fresh links.',
		},
	);
}
