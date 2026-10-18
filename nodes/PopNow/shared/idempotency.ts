import { createHash } from 'crypto';

/**
 * JSON with object keys sorted at every level, so two equal values always serialise to the same
 * string no matter how they were built. Undefined values are dropped, as JSON.stringify does.
 */
export function canonicalJson(value: unknown): string {
	return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((entry) => (entry === undefined ? null : sortKeys(entry)));
	}
	if (value !== null && typeof value === 'object') {
		const source = value as Record<string, unknown>;
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(source).sort()) {
			if (source[key] !== undefined) {
				sorted[key] = sortKeys(source[key]);
			}
		}
		return sorted;
	}
	return value;
}

export function sha256Hex(data: string | Buffer): string {
	return createHash('sha256').update(data).digest('hex');
}

export interface IdempotencyParts {
	/** n8n execution ID: a new manual or triggered run is new work. */
	executionId: string;
	/** Node ID: two PopNow nodes in one workflow never share a key. */
	nodeId: string;
	/**
	 * How many times this node already ran in this execution (loops). "Retry On Fail" reruns the
	 * node with the same run index, so its retries reuse the key while loop passes do not.
	 */
	runIndex: number;
	/** Position of the input item. */
	itemIndex: number;
	/** What is being submitted, with uploaded files represented by a hash of their bytes. */
	request: unknown;
}

/**
 * A deterministic Idempotency-Key. Resending the same item (a node retry, a network timeout)
 * yields the same key, so PopNow returns the task it already created instead of charging twice.
 * A changed input yields a new key. 68 characters, inside the API's 128-character limit.
 */
export function idempotencyKey(parts: IdempotencyParts): string {
	const material = canonicalJson({
		v: 1,
		executionId: parts.executionId,
		nodeId: parts.nodeId,
		runIndex: parts.runIndex,
		itemIndex: parts.itemIndex,
		request: parts.request,
	});
	return `n8n-${sha256Hex(material)}`;
}
