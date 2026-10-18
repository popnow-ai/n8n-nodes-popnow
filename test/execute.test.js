'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { envelope, fakeApi, fakeExecuteContext, fixtures, response, runNode } = require('./helpers');

const T2I = 'alibaba/z-image-turbo/text-to-image';
const I2V = 'bytedance/seedance-1.5-pro/image-to-video';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

const modelResponse = (id) => response(200, envelope(fixtures[id]));

function imageParams(overrides = {}) {
	return {
		resource: 'image',
		operation: 'generate',
		model: { mode: 'list', value: T2I },
		prompt: 'A red bicycle leaning on a brick wall, morning light',
		mediaInputs: {},
		modelParameters: {
			mappingMode: 'defineBelow',
			value: { aspect_ratio: '1:1', seed: 7 },
			schema: [],
		},
		additionalParameters: '{}',
		maxCredits: 200,
		generateOptions: {},
		...overrides,
	};
}

const finishedTask = {
	taskId: 'job_1',
	model: T2I,
	state: 'succeeded',
	cost: '0.01',
	settled: true,
	output: {
		assets: [
			{ url: 'https://files.test/job_1.png', mime: 'image/png', expiresAt: '2026-10-06T12:00:00Z' },
		],
	},
};

describe('Generate', () => {
	it('stops before creating a task when the quote is above the limit', async () => {
		const api = fakeApi({
			[`GET /api/v1/models/${T2I}`]: [modelResponse(T2I)],
			'POST /api/v1/jobs/quote': [
				response(200, envelope({ quoteId: 'q1', maxCredits: 250, maxCharge: '2.5' })),
			],
		});
		const context = fakeExecuteContext({ params: imageParams(), api });
		await assert.rejects(runNode(context), (error) => {
			assert.match(error.message, /could cost up to 250 credits, above the limit of 200 credits/);
			assert.match(error.message, /Nothing was charged/);
			return true;
		});
		assert.ok(!api.calls.some((call) => call.key === 'POST /api/v1/jobs/createTask'));
	});

	it('quotes, creates the task with a deterministic key, and returns the image as binary', async () => {
		const runOnce = async () => {
			const api = fakeApi({
				[`GET /api/v1/models/${T2I}`]: [modelResponse(T2I)],
				'POST /api/v1/jobs/quote': [
					response(200, envelope({ quoteId: 'q1', maxCredits: 2, maxCharge: '0.02' })),
				],
				'POST /api/v1/jobs/createTask': [response(200, envelope(finishedTask))],
				'GET /job_1.png': [response(200, PNG, { 'content-type': 'image/png' })],
			});
			const output = await runNode(fakeExecuteContext({ params: imageParams(), api }));
			return { api, output };
		};

		const first = await runOnce();
		const create = first.api.calls.find((call) => call.key === 'POST /api/v1/jobs/createTask');
		assert.equal(create.kind, 'auth');
		assert.deepEqual(create.options.body, {
			model: T2I,
			input: {
				prompt: 'A red bicycle leaning on a brick wall, morning light',
				aspect_ratio: '1:1',
				seed: 7,
			},
			quoteId: 'q1',
			expectedCredits: 2,
		});
		// Image models get the server-side wait, so most finish in one request.
		assert.equal(create.options.qs.wait, 50);
		const key = create.options.headers['Idempotency-Key'];
		assert.match(key, /^n8n-[0-9a-f]{64}$/);

		const download = first.api.calls.find((call) => call.key === 'GET /job_1.png');
		assert.equal(download.kind, 'plain', 'output files are fetched without the API key');

		const [items] = first.output;
		assert.equal(items.length, 1);
		assert.equal(items[0].json.taskId, 'job_1');
		assert.equal(items[0].json.estimatedCredits, 2);
		assert.equal(items[0].binary.data.mimeType, 'image/png');
		assert.equal(items[0].binary.data.fileName, 'job_1.png');
		assert.deepEqual(items[0].pairedItem, { item: 0 });

		// A retry of the same item (same execution, node, run and input) sends the same key.
		const second = await runOnce();
		const again = second.api.calls.find((call) => call.key === 'POST /api/v1/jobs/createTask');
		assert.equal(again.options.headers['Idempotency-Key'], key);
	});

	it('gives each item and each loop pass its own key', async () => {
		const keys = [];
		for (const runIndex of [0, 1]) {
			const api = fakeApi({
				[`GET /api/v1/models/${T2I}`]: [modelResponse(T2I)],
				'POST /api/v1/jobs/quote': [response(200, envelope({ quoteId: 'q', maxCredits: 2 }))],
				'POST /api/v1/jobs/createTask': [response(200, envelope(finishedTask))],
				'GET /job_1.png': [response(200, PNG)],
			});
			const items = [{ json: {} }, { json: {} }];
			await runNode(fakeExecuteContext({ params: imageParams(), api, items, runIndex }));
			for (const call of api.calls.filter((c) => c.key === 'POST /api/v1/jobs/createTask')) {
				keys.push(call.options.headers['Idempotency-Key']);
			}
		}
		assert.equal(keys.length, 4);
		assert.equal(new Set(keys).size, 4);
	});

	it('quotes again after a price change and resends under the same key', async () => {
		const api = fakeApi({
			[`GET /api/v1/models/${T2I}`]: [modelResponse(T2I)],
			'POST /api/v1/jobs/quote': [
				response(200, envelope({ quoteId: 'q1', maxCredits: 2 })),
				response(200, envelope({ quoteId: 'q2', maxCredits: 3 })),
			],
			'POST /api/v1/jobs/createTask': [
				response(409, { code: 40901, msg: 'Quote no longer matches', request_id: 'req_x' }),
				response(200, envelope(finishedTask)),
			],
			'GET /job_1.png': [response(200, PNG)],
		});
		await runNode(fakeExecuteContext({ params: imageParams(), api }));
		const creates = api.calls.filter((call) => call.key === 'POST /api/v1/jobs/createTask');
		assert.equal(creates.length, 2);
		assert.equal(
			creates[0].options.headers['Idempotency-Key'],
			creates[1].options.headers['Idempotency-Key'],
		);
		assert.equal(creates[1].options.body.quoteId, 'q2');
		assert.equal(creates[1].options.body.expectedCredits, 3);
	});

	it('does not resend when the new quote is above the limit', async () => {
		const api = fakeApi({
			[`GET /api/v1/models/${T2I}`]: [modelResponse(T2I)],
			'POST /api/v1/jobs/quote': [
				response(200, envelope({ quoteId: 'q1', maxCredits: 190 })),
				response(200, envelope({ quoteId: 'q2', maxCredits: 210 })),
			],
			'POST /api/v1/jobs/createTask': [
				response(409, { code: 40901, msg: 'Quote no longer matches', request_id: 'req_x' }),
			],
		});
		await assert.rejects(
			runNode(fakeExecuteContext({ params: imageParams(), api })),
			/above the limit/,
		);
		assert.equal(api.calls.filter((call) => call.key === 'POST /api/v1/jobs/createTask').length, 1);
	});

	it('uploads a binary input in three steps and keys the request by the file bytes', async () => {
		const keys = [];
		for (const attempt of [1, 2]) {
			const api = fakeApi({
				[`GET /api/v1/models/${I2V}`]: [modelResponse(I2V)],
				'POST /api/v1/common/upload-url': [
					response(
						200,
						envelope({
							fileId: `fil_${attempt}`,
							uploadUrl: `https://upload.test/put/${attempt}`,
							method: 'PUT',
							headers: { 'Content-Type': 'image/png', 'Content-Length': String(PNG.length) },
							maxBytes: 10485760,
						}),
					),
				],
				[`PUT /put/${attempt}`]: [response(200, '')],
				[`POST /api/v1/files/fil_${attempt}/commit`]: [
					response(200, envelope({ uri: `popnow://f/fil_${attempt}` })),
				],
				'POST /api/v1/jobs/quote': [response(200, envelope({ quoteId: 'q', maxCredits: 6 }))],
				'POST /api/v1/jobs/createTask': [
					response(202, envelope({ taskId: 'job_v', state: 'queued', estimatedCredits: 6 })),
				],
			});
			const items = [
				{
					json: {},
					binary: {
						photo: { data: PNG.toString('base64'), mimeType: 'image/png', fileName: 'start.png' },
					},
				},
			];
			const params = {
				resource: 'video',
				operation: 'generate',
				model: { mode: 'id', value: I2V },
				prompt: 'The camera slowly pushes in',
				mediaInputs: { input: [{ field: 'image_url', source: 'binary', binaryProperty: 'photo' }] },
				modelParameters: { mappingMode: 'defineBelow', value: { resolution: '480p' }, schema: [] },
				additionalParameters: '{}',
				maxCredits: 200,
				generateOptions: { waitForCompletion: false },
			};
			// Each attempt uses a different API key, so the upload cache cannot hand back the
			// first URI and the second attempt really uploads again.
			const context = fakeExecuteContext({ params, api, items });
			context.getCredentials = async () => ({
				apiKey: `sk-popnow-test-${attempt}`,
				baseUrl: 'https://api.test',
			});
			const [out] = await runNode(context);

			const put = api.calls.find((call) => call.key === `PUT /put/${attempt}`);
			assert.equal(put.kind, 'plain', 'the signed upload URL gets no API key');
			assert.equal(put.options.headers['Content-Type'], 'image/png');
			assert.ok(Buffer.isBuffer(put.options.body));
			const create = api.calls.find((call) => call.key === 'POST /api/v1/jobs/createTask');
			assert.equal(create.options.body.input.image_url, `popnow://f/fil_${attempt}`);
			assert.equal(create.options.qs, undefined, 'video skips the server-side wait');
			assert.equal(out[0].json.taskId, 'job_v');
			keys.push(create.options.headers['Idempotency-Key']);
		}
		// Different URIs, same bytes: the key stays the same, so PopNow can tell it is a resend.
		assert.equal(keys[0], keys[1]);
	});

	it('reports a missing required file before spending anything', async () => {
		const api = fakeApi({ [`GET /api/v1/models/${I2V}`]: [modelResponse(I2V)] });
		const params = {
			resource: 'video',
			operation: 'generate',
			model: { mode: 'id', value: I2V },
			prompt: 'x',
			mediaInputs: {},
			modelParameters: { mappingMode: 'defineBelow', value: {}, schema: [] },
			additionalParameters: '{}',
			maxCredits: 200,
			generateOptions: {},
		};
		await assert.rejects(runNode(fakeExecuteContext({ params, api })), /needs 'image_url'/);
		assert.equal(api.calls.length, 1);
	});

	it('turns a failed task into an error that names the task, or an item with continueOnFail', async () => {
		const failed = {
			taskId: 'job_f',
			state: 'failed',
			errorCode: 'content_rejected',
			errorMessage: 'Declined',
		};
		const routes = () => ({
			[`GET /api/v1/models/${T2I}`]: [modelResponse(T2I)],
			'POST /api/v1/jobs/quote': [response(200, envelope({ quoteId: 'q', maxCredits: 2 }))],
			'POST /api/v1/jobs/createTask': [response(200, envelope(failed))],
		});
		await assert.rejects(
			runNode(fakeExecuteContext({ params: imageParams(), api: fakeApi(routes()) })),
			(error) => {
				assert.match(error.message, /content_rejected: Declined/);
				assert.match(error.description, /nothing was charged/);
				assert.match(error.description, /job_f/);
				return true;
			},
		);
		const [items] = await runNode(
			fakeExecuteContext({ params: imageParams(), api: fakeApi(routes()), continueOnFail: true }),
		);
		assert.equal(items[0].json.taskId, 'job_f');
		assert.match(items[0].json.error, /content_rejected/);
	});
});

describe('Task', () => {
	it('retries a failed task with a stable key, waits and downloads the new result', async () => {
		const keys = [];
		for (const attempt of [1, 2]) {
			const api = fakeApi({
				'POST /api/v1/jobs/retry': [
					response(
						200,
						envelope({
							taskId: 'job_r',
							sourceTaskId: 'job_f',
							state: 'queued',
							estimatedCredits: 2,
							deadlineAt: '2099-01-01T00:00:00Z',
						}),
					),
				],
				'GET /api/v1/jobs/recordInfo': [
					response(200, envelope({ ...finishedTask, taskId: 'job_r', sourceTaskId: 'job_f' })),
				],
				'GET /job_1.png': [response(200, PNG, { 'content-type': 'image/png' })],
			});
			const params = { resource: 'task', operation: 'retry', taskId: ' job_f ', retryOptions: {} };
			const [items] = await runNode(fakeExecuteContext({ params, api }));
			const retry = api.calls.find((call) => call.key === 'POST /api/v1/jobs/retry');
			assert.deepEqual(retry.options.body, { taskId: 'job_f' });
			keys.push(retry.options.headers['Idempotency-Key']);
			const poll = api.calls.find((call) => call.key === 'GET /api/v1/jobs/recordInfo');
			assert.deepEqual(poll.options.qs, { taskId: 'job_r' });
			assert.equal(items[0].json.taskId, 'job_r');
			assert.equal(items[0].json.sourceTaskId, 'job_f');
			assert.equal(items[0].binary.data.mimeType, 'image/png');
			assert.ok(attempt);
		}
		assert.match(keys[0], /^n8n-[0-9a-f]{64}$/);
		assert.equal(keys[0], keys[1]);
	});

	it('returns the new task at once when Wait for Completion is off', async () => {
		const api = fakeApi({
			'POST /api/v1/jobs/retry': [
				response(200, envelope({ taskId: 'job_r', sourceTaskId: 'job_f', state: 'queued' })),
			],
		});
		const params = {
			resource: 'task',
			operation: 'retry',
			taskId: 'job_f',
			retryOptions: { waitForCompletion: false },
		};
		const [items] = await runNode(fakeExecuteContext({ params, api }));
		assert.equal(api.calls.length, 1);
		assert.equal(items[0].json.state, 'queued');
	});

	it('gets a task by ID without waiting', async () => {
		const api = fakeApi({
			'GET /api/v1/jobs/recordInfo': [
				response(200, envelope({ taskId: 'job_q', state: 'running', credits: 6, settled: false })),
			],
		});
		const params = { resource: 'task', operation: 'get', taskId: 'job_q', taskOptions: {} };
		const [items] = await runNode(fakeExecuteContext({ params, api }));
		assert.equal(items[0].json.state, 'running');
		assert.equal(items[0].binary, undefined);
	});
});

describe('Account and models', () => {
	it('reads the balance from the credit endpoint', async () => {
		const balance = {
			available: '12.34',
			held: '0.50',
			total: '12.84',
			availableCredits: 1234,
			heldCredits: 50,
			totalCredits: 1284,
		};
		const api = fakeApi({ 'GET /api/v1/chat/credit': [response(200, envelope(balance))] });
		const params = { resource: 'account', operation: 'getBalance' };
		const [items] = await runNode(fakeExecuteContext({ params, api }));
		assert.deepEqual(items[0].json, balance);
		const call = api.calls[0];
		assert.equal(call.kind, 'auth');
		assert.match(call.options.headers['User-Agent'], /^n8n-nodes-popnow\/\d+\.\d+\.\d+ /);
	});

	it('lists models with a modality filter and a limit', async () => {
		const api = fakeApi({
			'GET /api/v1/models': [
				response(
					200,
					envelope({
						total: 3,
						items: [
							{ model: 'a/b/text-to-image', credits: { unit: 'per_image', perUnit: 2 } },
							{ model: 'a/c/text-to-image', credits: { unit: 'per_image', perUnit: 4 } },
							{ model: 'a/d/text-to-image', credits: { unit: 'per_image', perUnit: 8 } },
						],
					}),
				),
			],
		});
		const params = {
			resource: 'model',
			operation: 'getAll',
			modality: 'image',
			search: '',
			returnAll: false,
			limit: 2,
		};
		const [items] = await runNode(fakeExecuteContext({ params, api }));
		assert.deepEqual(api.calls[0].options.qs, { modality: 'image' });
		assert.equal(items.length, 2);
		assert.equal(items[1].json.model, 'a/c/text-to-image');
	});

	it('maps an API error code to advice and keeps the request ID', async () => {
		const api = fakeApi({
			'GET /api/v1/chat/credit': [
				response(401, { code: 401, msg: 'Invalid API key', request_id: 'req_401' }),
			],
		});
		const params = { resource: 'account', operation: 'getBalance' };
		await assert.rejects(runNode(fakeExecuteContext({ params, api })), (error) => {
			assert.match(error.description, /popnow\.ai\/api\/console\/keys/);
			assert.match(error.description, /req_401/);
			return true;
		});
	});
});

describe('Package metadata', () => {
	it('keeps the User-Agent version in step with package.json', () => {
		const pkg = require('../package.json');
		const { PACKAGE_VERSION, USER_AGENT } = require('../dist/nodes/PopNow/shared/constants.js');
		assert.equal(PACKAGE_VERSION, pkg.version);
		assert.ok(USER_AGENT.startsWith(`n8n-nodes-popnow/${pkg.version} `));
		const { PopNowApi } = require('../dist/credentials/PopNowApi.credentials.js');
		const credential = new PopNowApi();
		assert.equal(credential.test.request.headers['User-Agent'], USER_AGENT);
	});

	it('registers the credential and node that package.json points to', () => {
		const pkg = require('../package.json');
		assert.equal(pkg.name, 'n8n-nodes-popnow');
		assert.ok(pkg.keywords.includes('n8n-community-node-package'));
		const { PopNowApi } = require('../dist/credentials/PopNowApi.credentials.js');
		const credential = new PopNowApi();
		assert.equal(credential.name, 'popNowApi');
		assert.equal(
			credential.properties.find((p) => p.name === 'baseUrl').default,
			'https://api.popnow.ai',
		);
		assert.equal(credential.test.request.url, '/api/v1/chat/credit');
		const { PopNow } = require('../dist/nodes/PopNow/PopNow.node.js');
		const node = new PopNow();
		assert.equal(node.description.name, 'popNow');
		assert.deepEqual(node.description.credentials, [{ name: 'popNowApi', required: true }]);
		const resources = node.description.properties
			.find((p) => p.name === 'resource')
			.options.map((o) => o.value);
		assert.deepEqual(resources, ['account', 'audio', 'file', 'image', 'model', 'task', 'video']);
	});
});
