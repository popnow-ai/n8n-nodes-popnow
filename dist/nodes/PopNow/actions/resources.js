"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTask = getTask;
exports.uploadBinary = uploadBinary;
exports.getManyModels = getManyModels;
exports.getModel = getModel;
exports.getBalance = getBalance;
const n8n_workflow_1 = require("n8n-workflow");
const task_1 = require("../shared/task");
const api_1 = require("../transport/api");
const common_1 = require("./common");
async function getTask(itemIndex) {
    var _a;
    const taskId = String(this.getNodeParameter('taskId', itemIndex, '')).trim();
    if (!taskId) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Task ID is empty', { itemIndex });
    }
    const options = this.getNodeParameter('taskOptions', itemIndex, {});
    let task = await api_1.apiRequest.call(this, 'GET', '/api/v1/jobs/recordInfo', { qs: { taskId } }, itemIndex);
    if (options.waitForCompletion === true && !(0, task_1.isSettledForOutput)(task)) {
        task = await common_1.waitForTask.call(this, taskId, (0, common_1.waitDeadline)(Number(options.maxWaitTime) || 0, task), itemIndex);
    }
    if (options.downloadOutput === false || task.state !== 'succeeded') {
        return [{ json: task }];
    }
    const binaryBase = ((_a = options.binaryPropertyName) === null || _a === void 0 ? void 0 : _a.trim()) || 'data';
    const binary = await common_1.downloadOutputs.call(this, task, binaryBase, itemIndex);
    return [{ json: task, binary }];
}
async function uploadBinary(itemIndex) {
    const property = String(this.getNodeParameter('binaryPropertyName', itemIndex, 'data')).trim() || 'data';
    const options = this.getNodeParameter('fileOptions', itemIndex, {});
    const { data, contentType, fileName } = await common_1.readBinary.call(this, itemIndex, property, options.contentType);
    const { uri, fileId, expiresAt } = await api_1.uploadFile.call(this, data, contentType, itemIndex);
    return [
        {
            json: {
                uri,
                fileId,
                fileName: fileName !== null && fileName !== void 0 ? fileName : null,
                mimeType: contentType,
                bytes: data.length,
                expiresAt: expiresAt !== null && expiresAt !== void 0 ? expiresAt : null,
            },
        },
    ];
}
const LIST_FIELDS_DROPPED = new Set(['inputSchema', 'examples']);
async function getManyModels(itemIndex) {
    const modality = String(this.getNodeParameter('modality', itemIndex, 'all'));
    const search = String(this.getNodeParameter('search', itemIndex, '')).trim();
    const returnAll = this.getNodeParameter('returnAll', itemIndex, false);
    const limit = returnAll ? Infinity : Number(this.getNodeParameter('limit', itemIndex, 50));
    const data = await api_1.apiRequest.call(this, 'GET', '/api/v1/models', {
        qs: {
            ...(modality !== 'all' ? { modality } : {}),
            ...(search ? { search } : {}),
        },
    }, itemIndex);
    const items = Array.isArray(data.items) ? data.items : [];
    return items
        .filter((item) => !!item && typeof item === 'object')
        .slice(0, limit)
        .map((item) => {
        const json = {};
        for (const [key, value] of Object.entries(item)) {
            if (!LIST_FIELDS_DROPPED.has(key)) {
                json[key] = value;
            }
        }
        return { json };
    });
}
async function getModel(itemIndex, run) {
    const modelId = common_1.getModelId.call(this, itemIndex);
    let pending = run.models.get(modelId);
    if (!pending) {
        pending = api_1.apiRequest.call(this, 'GET', (0, api_1.modelPath)(modelId), {}, itemIndex);
        run.models.set(modelId, pending);
    }
    return [{ json: await pending }];
}
async function getBalance(itemIndex) {
    const data = await api_1.apiRequest.call(this, 'GET', '/api/v1/chat/credit', {}, itemIndex);
    return [{ json: data }];
}
//# sourceMappingURL=resources.js.map