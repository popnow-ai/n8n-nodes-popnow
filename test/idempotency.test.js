'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { dist } = require('./helpers');
const { canonicalJson, idempotencyKey } = require(
	dist('nodes', 'PopNow', 'shared', 'idempotency.js'),
);

const base = {
	executionId: '1042',
	nodeId: '7f3c-node',
	runIndex: 0,
	itemIndex: 0,
	request: {
		op: 'createTask',
		model: 'alibaba/z-image-turbo/text-to-image',
		input: { prompt: 'a red bicycle', seed: 7 },
	},
};

describe('canonicalJson', () => {
	it('sorts keys at every level and keeps array order', () => {
		const a = canonicalJson({ b: 1, a: { d: [3, 1], c: 'x' } });
		const b = canonicalJson({ a: { c: 'x', d: [3, 1] }, b: 1 });
		assert.equal(a, b);
		assert.equal(a, '{"a":{"c":"x","d":[3,1]},"b":1}');
	});

	it('drops undefined values like JSON.stringify', () => {
		assert.equal(canonicalJson({ a: undefined, b: 2 }), '{"b":2}');
	});
});

describe('idempotencyKey', () => {
	it('is deterministic, so a retried item reuses its key', () => {
		assert.equal(idempotencyKey(base), idempotencyKey({ ...base }));
	});

	it('ignores the key order of the input', () => {
		const reordered = {
			...base,
			request: {
				input: { seed: 7, prompt: 'a red bicycle' },
				model: base.request.model,
				op: 'createTask',
			},
		};
		assert.equal(idempotencyKey(reordered), idempotencyKey(base));
	});

	it('changes with the execution, node, run, item and input', () => {
		const original = idempotencyKey(base);
		const variants = [
			{ ...base, executionId: '1043' },
			{ ...base, nodeId: 'another-node' },
			{ ...base, runIndex: 1 },
			{ ...base, itemIndex: 1 },
			{ ...base, request: { ...base.request, input: { prompt: 'a red bicycle', seed: 8 } } },
			{ ...base, request: { ...base.request, model: 'alibaba/z-image-turbo-lora/text-to-image' } },
		];
		const keys = new Set(variants.map((parts) => idempotencyKey(parts)));
		assert.equal(keys.size, variants.length);
		assert.ok(!keys.has(original));
	});

	it('fits the API limit of 128 characters and is not random-looking per call', () => {
		const key = idempotencyKey(base);
		assert.match(key, /^n8n-[0-9a-f]{64}$/);
		assert.ok(key.length <= 128);
	});
});
