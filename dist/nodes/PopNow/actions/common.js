"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newRunContext = newRunContext;
exports.getModelId = getModelId;
exports.getModelDetail = getModelDetail;
exports.parseJsonObject = parseJsonObject;
exports.uploadCached = uploadCached;
exports.readBinary = readBinary;
exports.collectInput = collectInput;
exports.quoteWithinLimit = quoteWithinLimit;
exports.keyFor = keyFor;
exports.waitDeadline = waitDeadline;
exports.waitForTask = waitForTask;
exports.taskFailedError = taskFailedError;
exports.downloadOutputs = downloadOutputs;
const n8n_workflow_1 = require("n8n-workflow");
const constants_1 = require("../shared/constants");
const idempotency_1 = require("../shared/idempotency");
const media_1 = require("../shared/media");
const quote_1 = require("../shared/quote");
const schema_1 = require("../shared/schema");
const task_1 = require("../shared/task");
const api_1 = require("../transport/api");
function newRunContext() {
    return { models: new Map() };
}
function getModelId(itemIndex) {
    const value = this.getNodeParameter('model', itemIndex, '', { extractValue: true });
    const modelId = typeof value === 'string' ? value.trim() : '';
    if (!modelId) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Choose a model', { itemIndex });
    }
    return modelId;
}
async function getModelDetail(modelId, run, itemIndex) {
    let pending = run.models.get(modelId);
    if (!pending) {
        pending = api_1.apiRequest.call(this, 'GET', (0, api_1.modelPath)(modelId), {}, itemIndex);
        run.models.set(modelId, pending);
        pending.catch(() => run.models.delete(modelId));
    }
    return await pending;
}
function parseJsonObject(value, label, itemIndex) {
    if (value === undefined || value === null || value === '') {
        return {};
    }
    let parsed = value;
    if (typeof value === 'string') {
        parsed = (0, n8n_workflow_1.jsonParse)(value, {
            errorMessage: `${label} is not valid JSON`,
        });
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `${label} must be a JSON object`, { itemIndex });
    }
    return parsed;
}
const UPLOAD_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const UPLOAD_EXPIRY_MARGIN_MS = 15 * 60 * 1000;
const UPLOAD_CACHE_LIMIT = 500;
const uploadCache = new Map();
async function uploadCached(data, contentType, itemIndex) {
    const digest = (0, idempotency_1.sha256Hex)(data);
    const account = await api_1.accountFingerprint.call(this);
    const cacheKey = `${account}:${contentType}:${digest}`;
    const now = Date.now();
    const cached = uploadCache.get(cacheKey);
    if (cached && now < cached.until) {
        return { uri: cached.uri, digest };
    }
    const { uri, expiresAt } = await api_1.uploadFile.call(this, data, contentType, itemIndex);
    const expiry = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    const until = Math.min(now + UPLOAD_CACHE_TTL_MS, Number.isFinite(expiry) ? expiry - UPLOAD_EXPIRY_MARGIN_MS : Infinity);
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
async function readBinary(itemIndex, propertyName, contentTypeOverride) {
    const meta = this.helpers.assertBinaryData(itemIndex, propertyName);
    const data = await this.helpers.getBinaryDataBuffer(itemIndex, propertyName);
    const contentType = (contentTypeOverride === null || contentTypeOverride === void 0 ? void 0 : contentTypeOverride.trim())
        ? contentTypeOverride.trim().toLowerCase()
        : (0, media_1.normalizeContentType)(meta.mimeType, meta.fileName);
    return { data, contentType, fileName: meta.fileName };
}
async function collectInput(itemIndex, schema) {
    var _a, _b, _c, _d, _e, _f, _g;
    const prompt = this.getNodeParameter('prompt', itemIndex, '');
    const mapper = this.getNodeParameter('modelParameters', itemIndex, null);
    const parameters = {};
    const removed = new Set(((_a = mapper === null || mapper === void 0 ? void 0 : mapper.schema) !== null && _a !== void 0 ? _a : []).filter((field) => field.removed === true).map((field) => field.id));
    const known = schema === null || schema === void 0 ? void 0 : schema.properties;
    for (const [name, value] of Object.entries((_b = mapper === null || mapper === void 0 ? void 0 : mapper.value) !== null && _b !== void 0 ? _b : {})) {
        if (removed.has(name) || (known && !(name in known))) {
            continue;
        }
        parameters[name] = value;
    }
    const extra = parseJsonObject.call(this, this.getNodeParameter('additionalParameters', itemIndex, '{}'), 'Additional Parameters (JSON)', itemIndex);
    const collection = this.getNodeParameter('mediaInputs', itemIndex, {});
    const entries = (Array.isArray(collection.input) ? collection.input : []);
    const listFields = new Set((0, schema_1.mediaFields)(schema)
        .filter((f) => f.multiple)
        .map((f) => f.name));
    const media = {};
    const mediaPrints = {};
    for (const entry of entries) {
        const field = String((_c = entry.field) !== null && _c !== void 0 ? _c : '').trim();
        if (!field) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'A media input has no field selected', {
                itemIndex,
            });
        }
        let value;
        let print;
        if (entry.source === 'url') {
            value = String((_d = entry.url) !== null && _d !== void 0 ? _d : '').trim();
            if (!value) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `The media input for '${field}' has no URL`, {
                    itemIndex,
                });
            }
            print = value;
        }
        else {
            const property = String((_e = entry.binaryProperty) !== null && _e !== void 0 ? _e : 'data').trim() || 'data';
            const binary = await readBinary.call(this, itemIndex, property);
            const uploaded = await uploadCached.call(this, binary.data, binary.contentType, itemIndex);
            value = uploaded.uri;
            print = `sha256:${uploaded.digest}`;
        }
        ((_f = media[field]) !== null && _f !== void 0 ? _f : (media[field] = [])).push(value);
        ((_g = mediaPrints[field]) !== null && _g !== void 0 ? _g : (mediaPrints[field] = [])).push(print);
    }
    const shape = (values) => {
        const shaped = {};
        for (const [field, list] of Object.entries(values)) {
            if (listFields.has(field)) {
                shaped[field] = list;
            }
            else if (list.length === 1) {
                shaped[field] = list[0];
            }
            else {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `'${field}' takes a single file, but ${list.length} media inputs target it`, { itemIndex });
            }
        }
        return shaped;
    };
    const input = (0, schema_1.buildInput)({ schema, prompt, parameters, media: shape(media), extra });
    const fingerprint = (0, schema_1.buildInput)({ schema, prompt, parameters, media: shape(mediaPrints), extra });
    const missing = (0, schema_1.missingRequiredMedia)(schema, input);
    if (missing.length > 0) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `This model needs ${missing.map((field) => `'${field.name}'`).join(', ')}`, {
            itemIndex,
            description: 'Add it under Media Inputs, from a binary field of the incoming item or from a URL.',
        });
    }
    return { input, fingerprint };
}
async function quoteWithinLimit(itemIndex, modelId, input, maxCredits) {
    const quote = await api_1.apiRequest.call(this, 'POST', '/api/v1/jobs/quote', { body: { model: modelId, input } }, itemIndex);
    const check = (0, quote_1.checkQuoteLimit)(quote, maxCredits);
    if (!check.ok) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), check.message, {
            itemIndex,
            description: 'Raise "Max Credits per Item" to allow it, or change what drives the price (duration, resolution, number of outputs).',
        });
    }
    return quote;
}
function keyFor(itemIndex, request) {
    var _a, _b;
    let runIndex = 0;
    try {
        const proxyRunIndex = this.getWorkflowDataProxy(itemIndex).$thisRunIndex;
        runIndex = typeof proxyRunIndex === 'number' ? proxyRunIndex : 0;
    }
    catch {
        runIndex = 0;
    }
    const executionId = (_b = (_a = this.getExecutionId) === null || _a === void 0 ? void 0 : _a.call(this)) !== null && _b !== void 0 ? _b : '';
    return (0, idempotency_1.idempotencyKey)({
        executionId: executionId || `no-execution-${Date.now()}-${Math.random()}`,
        nodeId: this.getNode().id,
        runIndex,
        itemIndex,
        request,
    });
}
function waitDeadline(maxWaitSeconds, task, model, now = Date.now()) {
    if (maxWaitSeconds > 0) {
        return now + maxWaitSeconds * 1000;
    }
    const deadlineAt = typeof task.deadlineAt === 'string' ? Date.parse(task.deadlineAt) : Number.NaN;
    if (Number.isFinite(deadlineAt)) {
        return Math.max(deadlineAt, now) + constants_1.DEADLINE_GRACE_SECONDS * 1000;
    }
    const timeout = Number(model === null || model === void 0 ? void 0 : model.taskTimeoutSeconds) || constants_1.FALLBACK_TASK_TIMEOUT_SECONDS;
    return now + (timeout + constants_1.DEADLINE_GRACE_SECONDS) * 1000;
}
async function waitForTask(taskId, deadlineMs, itemIndex) {
    let interval = constants_1.POLL_INITIAL_MS;
    for (;;) {
        const result = await api_1.apiCall.call(this, 'GET', '/api/v1/jobs/recordInfo', {
            qs: { taskId },
        });
        if (result.ok) {
            if ((0, task_1.isSettledForOutput)(result.data)) {
                return result.data;
            }
        }
        else if (result.status > 0 &&
            result.status < 500 &&
            result.status !== 408 &&
            result.status !== 429) {
            throw (0, api_1.apiError)(this, result, itemIndex);
        }
        if (Date.now() + interval > deadlineMs) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Task ${taskId} did not finish within the wait time`, {
                itemIndex,
                description: `It may still be running on PopNow and is charged if it succeeds. Do not resubmit it; fetch the result later with Task > Get and task ID ${taskId}, or raise "Max Wait Time".`,
            });
        }
        if (!(await (0, api_1.cancellableSleep)(this, interval))) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Stopped waiting for task ${taskId}`, {
                itemIndex,
                description: 'The task keeps running on PopNow and is charged if it succeeds. Fetch it later with Task > Get.',
            });
        }
        interval = Math.min(interval * constants_1.POLL_FACTOR, constants_1.POLL_MAX_MS);
    }
}
function taskFailedError(task, itemIndex) {
    var _a;
    const code = typeof task.errorCode === 'string' && task.errorCode ? task.errorCode : String(task.state);
    const message = typeof task.errorMessage === 'string' && task.errorMessage
        ? task.errorMessage
        : `the task ended as ${String(task.state)}`;
    const error = new n8n_workflow_1.NodeOperationError(this.getNode(), `${code}: ${message}`, {
        itemIndex,
        description: `${(0, task_1.taskFailureHint)(task.errorCode)} Task ID: ${String((_a = task.taskId) !== null && _a !== void 0 ? _a : '')}.`,
    });
    error.context.taskId = task.taskId;
    return error;
}
async function downloadOutputs(task, binaryBase, itemIndex) {
    var _a;
    const binary = {};
    const taskId = String((_a = task.taskId) !== null && _a !== void 0 ? _a : 'output');
    let index = 0;
    for (const asset of (0, task_1.outputAssets)(task)) {
        if (typeof asset.url !== 'string' || !asset.url) {
            continue;
        }
        const { data, contentType } = await api_1.downloadFile.call(this, asset.url, itemIndex);
        const mime = (typeof asset.mime === 'string' && asset.mime) ||
            contentType.split(';')[0] ||
            'application/octet-stream';
        const fileName = `${taskId}${index > 0 ? `-${index}` : ''}.${(0, task_1.extensionForMime)(mime)}`;
        binary[(0, task_1.binaryKeyFor)(binaryBase, index)] = await this.helpers.prepareBinaryData(data, fileName, mime);
        index += 1;
    }
    return binary;
}
//# sourceMappingURL=common.js.map