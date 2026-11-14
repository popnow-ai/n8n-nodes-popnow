"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = generate;
exports.getQuote = getQuote;
exports.retryTask = retryTask;
const n8n_workflow_1 = require("n8n-workflow");
const constants_1 = require("../shared/constants");
const quote_1 = require("../shared/quote");
const task_1 = require("../shared/task");
const api_1 = require("../transport/api");
const common_1 = require("./common");
function priceConfirmation(quote) {
    const confirmation = { quoteId: quote.quoteId };
    const maxCredits = (0, quote_1.parseAmount)(quote.maxCredits);
    if (maxCredits !== undefined) {
        confirmation.expectedCredits = maxCredits;
    }
    else if (quote.estimatedCost !== undefined) {
        confirmation.expectedCost = quote.estimatedCost;
    }
    return confirmation;
}
async function finishTask(itemIndex, created, options, model, wait) {
    var _a, _b, _c;
    if (!wait) {
        return [{ json: created }];
    }
    const taskId = String((_a = created.taskId) !== null && _a !== void 0 ? _a : '');
    const task = (0, task_1.isSettledForOutput)(created)
        ? created
        : await common_1.waitForTask.call(this, taskId, (0, common_1.waitDeadline)(Number(options.maxWaitTime) || 0, created, model), itemIndex);
    if (task.state !== 'succeeded') {
        throw common_1.taskFailedError.call(this, task, itemIndex);
    }
    const json = {
        ...task,
        estimatedCredits: (_b = task.estimatedCredits) !== null && _b !== void 0 ? _b : created.estimatedCredits,
    };
    if (options.downloadOutput === false) {
        return [{ json }];
    }
    const binaryBase = ((_c = options.binaryPropertyName) === null || _c === void 0 ? void 0 : _c.trim()) || 'data';
    const binary = await common_1.downloadOutputs.call(this, task, binaryBase, itemIndex);
    return [{ json, binary }];
}
async function generate(itemIndex, run) {
    var _a, _b, _c;
    const modelId = common_1.getModelId.call(this, itemIndex);
    const model = await common_1.getModelDetail.call(this, modelId, run, itemIndex);
    const schema = model.inputSchema;
    const { input, fingerprint } = await common_1.collectInput.call(this, itemIndex, schema);
    const maxCredits = Number(this.getNodeParameter('maxCredits', itemIndex, constants_1.DEFAULT_MAX_CREDITS));
    const options = this.getNodeParameter('generateOptions', itemIndex, {});
    const callbackUrl = ((_a = options.callbackUrl) === null || _a === void 0 ? void 0 : _a.trim()) || undefined;
    const wait = options.waitForCompletion !== false;
    let quote = await common_1.quoteWithinLimit.call(this, itemIndex, modelId, input, maxCredits);
    const idempotencyKey = common_1.keyFor.call(this, itemIndex, {
        op: 'createTask',
        model: modelId,
        input: fingerprint,
        callBackUrl: callbackUrl !== null && callbackUrl !== void 0 ? callbackUrl : null,
    });
    const headers = { 'Idempotency-Key': idempotencyKey };
    const retention = Math.floor(Number(options.retentionSeconds) || 0);
    if (retention > 0) {
        headers['X-PopNow-Retention'] = String(retention);
    }
    const serverWait = wait && constants_1.SERVER_WAIT_MODALITIES.has(String(model.modality));
    let created;
    for (let attempt = 0; attempt < 2 && created === undefined; attempt++) {
        const body = { model: modelId, input, ...priceConfirmation(quote) };
        if (callbackUrl) {
            body.callBackUrl = callbackUrl;
        }
        const result = await api_1.apiCall.call(this, 'POST', '/api/v1/jobs/createTask', {
            qs: serverWait ? { wait: constants_1.SERVER_WAIT_SECONDS } : undefined,
            body,
            headers,
            timeoutMs: serverWait ? (constants_1.SERVER_WAIT_SECONDS + 40) * 1000 : 60000,
            retryConflictOnce: true,
        });
        if (result.ok) {
            created = result.data;
        }
        else if (result.code === 40901 && attempt === 0) {
            quote = await common_1.quoteWithinLimit.call(this, itemIndex, modelId, input, maxCredits);
        }
        else {
            throw (0, api_1.apiError)(this, result, itemIndex);
        }
    }
    if (created === undefined) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'The task could not be created', { itemIndex });
    }
    const enriched = {
        ...created,
        model: (_b = created.model) !== null && _b !== void 0 ? _b : modelId,
        estimatedCredits: (_c = created.estimatedCredits) !== null && _c !== void 0 ? _c : quote.maxCredits,
    };
    return await finishTask.call(this, itemIndex, enriched, options, model, wait);
}
async function getQuote(itemIndex, run) {
    const modelId = common_1.getModelId.call(this, itemIndex);
    const model = await common_1.getModelDetail.call(this, modelId, run, itemIndex);
    const { input } = await common_1.collectInput.call(this, itemIndex, model.inputSchema);
    const quote = await api_1.apiRequest.call(this, 'POST', '/api/v1/jobs/quote', { body: { model: modelId, input } }, itemIndex);
    return [{ json: { model: modelId, ...quote, input } }];
}
async function retryTask(itemIndex) {
    const taskId = String(this.getNodeParameter('taskId', itemIndex, '')).trim();
    if (!taskId) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Task ID is empty', { itemIndex });
    }
    const options = this.getNodeParameter('retryOptions', itemIndex, {});
    const wait = options.waitForCompletion !== false;
    const idempotencyKey = common_1.keyFor.call(this, itemIndex, { op: 'retry', taskId });
    const created = await api_1.apiRequest.call(this, 'POST', '/api/v1/jobs/retry', { body: { taskId }, headers: { 'Idempotency-Key': idempotencyKey } }, itemIndex);
    return await finishTask.call(this, itemIndex, created, options, undefined, wait);
}
//# sourceMappingURL=media.js.map