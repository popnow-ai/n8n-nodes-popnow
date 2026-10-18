'use strict';

// Test doubles for running the compiled node without n8n. Tests run against dist/, so
// `npm test` builds first.

const path = require('node:path');

const dist = (...parts) => path.join(__dirname, '..', 'dist', ...parts);
const fixtures = require('./fixtures/schemas.json');

function envelope(data, code = 200, msg = 'success') {
	return { code, msg, data, request_id: 'req_test' };
}

function response(statusCode, body, headers = {}) {
	return { statusCode, body, headers };
}

/**
 * A fake API. `routes` maps "METHOD /path" to a function (request, calls) => response, or to an
 * array of responses served in order. Every request is recorded in `calls`.
 */
function fakeApi(routes) {
	const calls = [];
	const handle = (kind, options) => {
		const url = new URL(options.url);
		const key = `${options.method ?? 'GET'} ${url.pathname}`;
		calls.push({ kind, key, options });
		const route = routes[key] ?? routes[`${options.method ?? 'GET'} *`];
		if (!route) {
			throw new Error(`unexpected request ${key}`);
		}
		if (Array.isArray(route)) {
			if (route.length === 0) {
				throw new Error(`no more responses for ${key}`);
			}
			return route.length > 1 ? route.shift() : route[0];
		}
		return route(options, calls);
	};
	return { calls, handle };
}

/** The slice of IExecuteFunctions the node uses. */
function fakeExecuteContext({
	params,
	items = [{ json: {} }],
	api,
	executionId = 'exec-1',
	nodeId = 'node-1',
	runIndex = 0,
	continueOnFail = false,
}) {
	const node = {
		id: nodeId,
		name: 'PopNow',
		type: 'n8n-nodes-popnow.popNow',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	};
	const paramFor = (itemIndex) => (typeof params === 'function' ? params(itemIndex) : params);
	return {
		getInputData: () => items,
		getNode: () => node,
		getExecutionId: () => executionId,
		getWorkflowDataProxy: () => ({ $thisRunIndex: runIndex }),
		getExecutionCancelSignal: () => undefined,
		continueOnFail: () => continueOnFail,
		getCredentials: async () => ({ apiKey: 'sk-popnow-test', baseUrl: 'https://api.test' }),
		getNodeParameter(name, itemIndex, fallback, options) {
			const values = paramFor(itemIndex);
			let value = Object.prototype.hasOwnProperty.call(values, name) ? values[name] : fallback;
			if (
				options &&
				options.extractValue &&
				value &&
				typeof value === 'object' &&
				'value' in value
			) {
				value = value.value;
			}
			if (value === undefined) {
				throw new Error(`missing parameter ${name}`);
			}
			return value;
		},
		helpers: {
			httpRequestWithAuthentication: async (credentialName, options) => {
				if (credentialName !== 'popNowApi') {
					throw new Error(`wrong credential ${credentialName}`);
				}
				return api.handle('auth', options);
			},
			httpRequest: async (options) => api.handle('plain', options),
			assertBinaryData(itemIndex, property) {
				const binary = items[itemIndex].binary && items[itemIndex].binary[property];
				if (!binary) {
					throw new Error(`no binary ${property}`);
				}
				return binary;
			},
			getBinaryDataBuffer: async (itemIndex, property) =>
				Buffer.from(items[itemIndex].binary[property].data, 'base64'),
			prepareBinaryData: async (buffer, fileName, mimeType) => ({
				data: buffer.toString('base64'),
				fileName,
				mimeType,
			}),
		},
	};
}

async function runNode(context) {
	const { PopNow } = require(dist('nodes', 'PopNow', 'PopNow.node.js'));
	const node = new PopNow();
	return node.execute.call(context);
}

module.exports = { dist, envelope, fakeApi, fakeExecuteContext, fixtures, response, runNode };
