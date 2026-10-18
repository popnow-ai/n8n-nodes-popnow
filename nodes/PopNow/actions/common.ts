import type {
	IBinaryKeyData,
	IDataObject,
	IExecuteFunctions,
	ResourceMapperValue,
} from 'n8n-workflow';
import { jsonParse, NodeOperationError } from 'n8n-workflow';

import {
	DEADLINE_GRACE_SECONDS,
	FALLBACK_TASK_TIMEOUT_SECONDS,
	POLL_FACTOR,
	POLL_INITIAL_MS,
	POLL_MAX_MS,
} from '../shared/constants';
import { idempotencyKey, sha256Hex } from '../shared/idempotency';
import { normalizeContentType } from '../shared/media';
import { checkQuoteLimit } from '../shared/quote';
import type { ModelSchema } from '../shared/schema';
import { buildInput, mediaFields, missingRequiredMedia } from '../shared/schema';
import {
	binaryKeyFor,
	extensionForMime,
	isSettledForOutput,
	outputAssets,
	taskFailureHint,
} from '../shared/task';
import {
	accountFingerprint,
	apiCall,
	apiError,
	apiRequest,
	cancellableSleep,
	downloadFile,
	modelPath,
	uploadFile,
} from '../transport/api';

/** State shared by the items of one node execution. */
export interface RunContext {
	models: Map<string, Promise<IDataObject>>;
}

export function newRunContext(): RunContext {
	return { models: new Map() };
}

export function getModelId(this: IExecuteFunctions, itemIndex: number): string {
	const value = this.getNodeParameter('model', itemIndex, '', { extractValue: true });
	const modelId = typeof value === 'string' ? value.trim() : '';
	if (!modelId) {
		throw new NodeOperationError(this.getNode(), 'Choose a model', { itemIndex });
	}
	return modelId;
}

export async function getModelDetail(
	this: IExecuteFunctions,
	modelId: string,
	run: RunContext,
	itemIndex: number,
): Promise<IDataObject> {
	let pending = run.models.get(modelId);
	if (!pending) {
		pending = apiRequest.call(this, 'GET', modelPath(modelId), {}, itemIndex);
		run.models.set(modelId, pending);
		// A failed lookup must not stay cached for the next item.
		pending.catch(() => run.models.delete(modelId));
	}
	return await pending;
}

export function parseJsonObject(
	this: IExecuteFunctions,
	value: unknown,
	label: string,
	itemIndex: number,
): IDataObject {
	if (value === undefined || value === null || value === '') {
		return {};
	}
	let parsed: unknown = value;
	if (typeof value === 'string') {
		parsed = jsonParse(value, {
			errorMessage: `${label} is not valid JSON`,
		});
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new NodeOperationError(this.getNode(), `${label} must be a JSON object`, { itemIndex });
	}
	return parsed as IDataObject;
}

// -- Uploads -----------------------------------------------------------------

const UPLOAD_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** Stop reusing an upload this long before the file itself expires. */
const UPLOAD_EXPIRY_MARGIN_MS = 15 * 60 * 1000;
const UPLOAD_CACHE_LIMIT = 500;

/**
 * Uploaded files are temporary (the commit answer says until when). Reusing the URI while it is
 * still valid when the same bytes are sent again means a "Retry On Fail" resends the identical
 * request, which PopNow then recognises by its Idempotency-Key instead of rejecting it as a
 * different request.
 */
const uploadCache = new Map<string, { uri: string; until: number }>();

export async function uploadCached(
	this: IExecuteFunctions,
	data: Buffer,
	contentType: string,
	itemIndex: number,
): Promise<{ uri: string; digest: string }> {
	const digest = sha256Hex(data);
	const account = await accountFingerprint.call(this);
	const cacheKey = `${account}:${contentType}:${digest}`;
	const now = Date.now();
	const cached = uploadCache.get(cacheKey);
	if (cached && now < cached.until) {
		return { uri: cached.uri, digest };
	}
	const { uri, expiresAt } = await uploadFile.call(this, data, contentType, itemIndex);
	const expiry = expiresAt ? Date.parse(expiresAt) : Number.NaN;
	const until = Math.min(
		now + UPLOAD_CACHE_TTL_MS,
		Number.isFinite(expiry) ? expiry - UPLOAD_EXPIRY_MARGIN_MS : Infinity,
	);
	if (uploadCache.size >= UPLOAD_CACHE_LIMIT) {
		const oldest = uploadCache.keys().next().value;
		if (oldest !== undefined) {
			uploadCache.delete(oldest);
		}
	}
	if (until > now) {
		uploadCache.set(cacheKey, { uri, until });
	}
	return { uri, digest };
}

export async function readBinary(
	this: IExecuteFunctions,
	itemIndex: number,
	propertyName: string,
	contentTypeOverride?: string,
): Promise<{ data: Buffer; contentType: string; fileName?: string }> {
	const meta = this.helpers.assertBinaryData(itemIndex, propertyName);
	const data = await this.helpers.getBinaryDataBuffer(itemIndex, propertyName);
	const contentType = contentTypeOverride?.trim()
		? contentTypeOverride.trim().toLowerCase()
		: normalizeContentType(meta.mimeType, meta.fileName);
	return { data, contentType, fileName: meta.fileName };
}

// -- Task input ---------------------------------------------------------------

export interface CollectedInput {
	input: IDataObject;
	/** The same input with uploaded files replaced by a hash of their bytes. */
	fingerprint: IDataObject;
}

interface MediaEntry {
	field?: string;
	source?: string;
	binaryProperty?: string;
	url?: string;
}

/** Prompt, file inputs, model parameters and the JSON box, merged into a task's `input`. */
export async function collectInput(
	this: IExecuteFunctions,
	itemIndex: number,
	schema: ModelSchema | undefined,
): Promise<CollectedInput> {
	const prompt = this.getNodeParameter('prompt', itemIndex, '') as string;

	const mapper = this.getNodeParameter(
		'modelParameters',
		itemIndex,
		null,
	) as ResourceMapperValue | null;
	const parameters: Record<string, unknown> = {};
	const removed = new Set(
		(mapper?.schema ?? []).filter((field) => field.removed === true).map((field) => field.id),
	);
	const known = schema?.properties;
	for (const [name, value] of Object.entries(mapper?.value ?? {})) {
		// Fields left over from a previously selected model are not this model's parameters.
		if (removed.has(name) || (known && !(name in known))) {
			continue;
		}
		parameters[name] = value;
	}

	const extra = parseJsonObject.call(
		this,
		this.getNodeParameter('additionalParameters', itemIndex, '{}'),
		'Additional Parameters (JSON)',
		itemIndex,
	);

	const collection = this.getNodeParameter('mediaInputs', itemIndex, {}) as IDataObject;
	const entries = (Array.isArray(collection.input) ? collection.input : []) as MediaEntry[];
	const listFields = new Set(
		mediaFields(schema)
			.filter((f) => f.multiple)
			.map((f) => f.name),
	);
	const media: Record<string, string[]> = {};
	const mediaPrints: Record<string, string[]> = {};
	for (const entry of entries) {
		const field = String(entry.field ?? '').trim();
		if (!field) {
			throw new NodeOperationError(this.getNode(), 'A media input has no field selected', {
				itemIndex,
			});
		}
		let value: string;
		let print: string;
		if (entry.source === 'url') {
			value = String(entry.url ?? '').trim();
			if (!value) {
				throw new NodeOperationError(this.getNode(), `The media input for '${field}' has no URL`, {
					itemIndex,
				});
			}
			print = value;
		} else {
			const property = String(entry.binaryProperty ?? 'data').trim() || 'data';
			const binary = await readBinary.call(this, itemIndex, property);
			const uploaded = await uploadCached.call(this, binary.data, binary.contentType, itemIndex);
			value = uploaded.uri;
			print = `sha256:${uploaded.digest}`;
		}
		(media[field] ??= []).push(value);
		(mediaPrints[field] ??= []).push(print);
	}

	const shape = (values: Record<string, string[]>): Record<string, string | string[]> => {
		const shaped: Record<string, string | string[]> = {};
		for (const [field, list] of Object.entries(values)) {
			if (listFields.has(field)) {
				shaped[field] = list;
			} else if (list.length === 1) {
				shaped[field] = list[0];
			} else {
				throw new NodeOperationError(
					this.getNode(),
					`'${field}' takes a single file, but ${list.length} media inputs target it`,
					{ itemIndex },
				);
			}
		}
		return shaped;
	};

	const input = buildInput({ schema, prompt, parameters, media: shape(media), extra });
	const fingerprint = buildInput({ schema, prompt, parameters, media: shape(mediaPrints), extra });

	const missing = missingRequiredMedia(schema, input);
	if (missing.length > 0) {
		throw new NodeOperationError(
			this.getNode(),
			`This model needs ${missing.map((field) => `'${field.name}'`).join(', ')}`,
			{
				itemIndex,
				description:
					'Add it under Media Inputs, from a binary field of the incoming item or from a URL.',
			},
		);
	}
	return { input, fingerprint };
}

// -- Price ------------------------------------------------------------------

export async function quoteWithinLimit(
	this: IExecuteFunctions,
	itemIndex: number,
	modelId: string,
	input: IDataObject,
	maxCredits: number,
): Promise<IDataObject> {
	const quote = await apiRequest.call(
		this,
		'POST',
		'/api/v1/jobs/quote',
		{ body: { model: modelId, input } },
		itemIndex,
	);
	const check = checkQuoteLimit(quote, maxCredits);
	if (!check.ok) {
		throw new NodeOperationError(this.getNode(), check.message, {
			itemIndex,
			description:
				'Raise "Max Credits per Item" to allow it, or change what drives the price (duration, resolution, number of outputs).',
		});
	}
	return quote;
}

// -- Idempotency ----------------------------------------------------------------

export function keyFor(this: IExecuteFunctions, itemIndex: number, request: unknown): string {
	let runIndex = 0;
	try {
		const proxyRunIndex = this.getWorkflowDataProxy(itemIndex).$thisRunIndex;
		runIndex = typeof proxyRunIndex === 'number' ? proxyRunIndex : 0;
	} catch {
		runIndex = 0;
	}
	const executionId = this.getExecutionId?.() ?? '';
	return idempotencyKey({
		// Without an execution ID two separate runs would share keys, and the second would get the
		// first run's task back. A per-call value keeps them apart in that (unexpected) case.
		executionId: executionId || `no-execution-${Date.now()}-${Math.random()}`,
		nodeId: this.getNode().id,
		runIndex,
		itemIndex,
		request,
	});
}

// -- Waiting ----------------------------------------------------------------------

/** When to stop waiting: the user's limit, or the task's own deadline plus a grace period. */
export function waitDeadline(
	maxWaitSeconds: number,
	task: IDataObject,
	model?: IDataObject,
	now = Date.now(),
): number {
	if (maxWaitSeconds > 0) {
		return now + maxWaitSeconds * 1000;
	}
	const deadlineAt = typeof task.deadlineAt === 'string' ? Date.parse(task.deadlineAt) : Number.NaN;
	if (Number.isFinite(deadlineAt)) {
		return Math.max(deadlineAt, now) + DEADLINE_GRACE_SECONDS * 1000;
	}
	const timeout = Number(model?.taskTimeoutSeconds) || FALLBACK_TASK_TIMEOUT_SECONDS;
	return now + (timeout + DEADLINE_GRACE_SECONDS) * 1000;
}

export async function waitForTask(
	this: IExecuteFunctions,
	taskId: string,
	deadlineMs: number,
	itemIndex: number,
): Promise<IDataObject> {
	let interval = POLL_INITIAL_MS;
	for (;;) {
		const result = await apiCall.call(this, 'GET', '/api/v1/jobs/recordInfo', {
			qs: { taskId },
		});
		if (result.ok) {
			// Terminal, with every output file that will ever have a URL already carrying one.
			if (isSettledForOutput(result.data)) {
				return result.data;
			}
		} else if (
			result.status > 0 &&
			result.status < 500 &&
			result.status !== 408 &&
			result.status !== 429
		) {
			// A 4xx other than a rate limit will not fix itself by polling again.
			throw apiError(this, result, itemIndex);
		}
		// One failed poll is not a failed task: keep polling while the budget lasts.
		if (Date.now() + interval > deadlineMs) {
			throw new NodeOperationError(
				this.getNode(),
				`Task ${taskId} did not finish within the wait time`,
				{
					itemIndex,
					description: `It may still be running on PopNow and is charged if it succeeds. Do not resubmit it; fetch the result later with Task > Get and task ID ${taskId}, or raise "Max Wait Time".`,
				},
			);
		}
		if (!(await cancellableSleep(this, interval))) {
			throw new NodeOperationError(this.getNode(), `Stopped waiting for task ${taskId}`, {
				itemIndex,
				description:
					'The task keeps running on PopNow and is charged if it succeeds. Fetch it later with Task > Get.',
			});
		}
		interval = Math.min(interval * POLL_FACTOR, POLL_MAX_MS);
	}
}

export function taskFailedError(
	this: IExecuteFunctions,
	task: IDataObject,
	itemIndex: number,
): NodeOperationError {
	const code =
		typeof task.errorCode === 'string' && task.errorCode ? task.errorCode : String(task.state);
	const message =
		typeof task.errorMessage === 'string' && task.errorMessage
			? task.errorMessage
			: `the task ended as ${String(task.state)}`;
	const error = new NodeOperationError(this.getNode(), `${code}: ${message}`, {
		itemIndex,
		description: `${taskFailureHint(task.errorCode)} Task ID: ${String(task.taskId ?? '')}.`,
	});
	error.context.taskId = task.taskId;
	return error;
}

/** Download every finished output file into n8n binary fields: data, data_1, data_2... */
export async function downloadOutputs(
	this: IExecuteFunctions,
	task: IDataObject,
	binaryBase: string,
	itemIndex: number,
): Promise<IBinaryKeyData> {
	const binary: IBinaryKeyData = {};
	const taskId = String(task.taskId ?? 'output');
	let index = 0;
	for (const asset of outputAssets(task)) {
		if (typeof asset.url !== 'string' || !asset.url) {
			continue;
		}
		const { data, contentType } = await downloadFile.call(this, asset.url, itemIndex);
		const mime =
			(typeof asset.mime === 'string' && asset.mime) ||
			contentType.split(';')[0] ||
			'application/octet-stream';
		const fileName = `${taskId}${index > 0 ? `-${index}` : ''}.${extensionForMime(mime)}`;
		binary[binaryKeyFor(binaryBase, index)] = await this.helpers.prepareBinaryData(
			data,
			fileName,
			mime,
		);
		index += 1;
	}
	return binary;
}
