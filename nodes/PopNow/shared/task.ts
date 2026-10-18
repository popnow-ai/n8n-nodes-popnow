import type { IDataObject } from 'n8n-workflow';

export const ACTIVE_STATES = new Set(['queued', 'running']);
export const KNOWN_TERMINAL_STATES = new Set(['succeeded', 'failed', 'expired', 'canceled']);

/** The API documents "terminal" as "not queued or running", which also covers future states. */
export function isTerminal(state: unknown): boolean {
	return typeof state === 'string' && state !== '' && !ACTIVE_STATES.has(state);
}

export function outputAssets(task: IDataObject): IDataObject[] {
	const output = task.output;
	if (!output || typeof output !== 'object' || Array.isArray(output)) {
		return [];
	}
	const assets = (output as IDataObject).assets;
	if (!Array.isArray(assets)) {
		return [];
	}
	return assets.filter(
		(asset): asset is IDataObject => !!asset && typeof asset === 'object' && !Array.isArray(asset),
	);
}

export function outputText(task: IDataObject): string | undefined {
	const output = task.output;
	if (!output || typeof output !== 'object' || Array.isArray(output)) {
		return undefined;
	}
	const text = (output as IDataObject).text;
	return typeof text === 'string' ? text : undefined;
}

/** A succeeded task can still have files that are being copied into storage. */
export function hasPendingAssets(task: IDataObject): boolean {
	if (task.state !== 'succeeded') {
		return false;
	}
	return outputAssets(task).some((asset) => asset.pending === true && asset.unavailable !== true);
}

/** Finished, and every output file that will ever have a URL has one. */
export function isSettledForOutput(task: IDataObject): boolean {
	return isTerminal(task.state) && !hasPendingAssets(task);
}

const EXTENSION_BY_MIME: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'video/mp4': 'mp4',
	'video/webm': 'webm',
	'video/quicktime': 'mov',
	'audio/mpeg': 'mp3',
	'audio/mp3': 'mp3',
	'audio/wav': 'wav',
	'audio/x-wav': 'wav',
	'audio/ogg': 'ogg',
	'audio/flac': 'flac',
	'audio/aac': 'aac',
	'audio/mp4': 'm4a',
	'text/plain': 'txt',
	'application/json': 'json',
};

export function extensionForMime(mime: unknown): string {
	if (typeof mime !== 'string') {
		return 'bin';
	}
	const base = mime.split(';')[0].trim().toLowerCase();
	return EXTENSION_BY_MIME[base] ?? (base.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin');
}

/** data, data_1, data_2...: the first file keeps the plain name so single outputs are simple. */
export function binaryKeyFor(base: string, index: number): string {
	return index === 0 ? base : `${base}_${index}`;
}

/** Hints for the failure codes a task can end with. */
export function taskFailureHint(errorCode: unknown): string {
	switch (errorCode) {
		case 'content_rejected':
			return 'The model declined this request. Unless the model page says refusals are billed, nothing was charged.';
		case 'invalid_asset':
			return 'An input file could not be read. Check that links open without a login and that the file type matches the field.';
		case 'invalid_request':
			return 'The model rejected one of the inputs. Check the field named in the message against Model > Get.';
		case 'unsupported_combination':
			return 'No deployment serves this combination of parameters. Change the parameter named in the message, or pick another model.';
		case 'timeout':
			return 'The model did not finish in time. Nothing was charged; try again later.';
		case 'rate_limited':
		case 'upstream_unavailable':
		case 'upstream_failed':
		case 'generation_failed':
			return 'The generation did not complete and the held amount was released. Running the node again usually works.';
		default:
			return 'Failed and expired tasks are normally not charged; the task record shows cost and settled.';
	}
}
