"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PopNow = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const common_1 = require("./actions/common");
const media_1 = require("./actions/media");
const resources_1 = require("./actions/resources");
const descriptions_1 = require("./descriptions");
const methods_1 = require("./methods");
const constants_1 = require("./shared/constants");
const OPERATIONS = {
    'image:generate': media_1.generate,
    'video:generate': media_1.generate,
    'audio:generate': media_1.generate,
    'task:get': resources_1.getTask,
    'task:retry': media_1.retryTask,
    'file:upload': resources_1.uploadBinary,
    'model:getAll': resources_1.getManyModels,
    'model:get': resources_1.getModel,
    'model:getQuote': media_1.getQuote,
    'account:getBalance': resources_1.getBalance,
};
class PopNow {
    constructor() {
        this.description = {
            displayName: 'PopNow',
            name: 'popNow',
            icon: { light: 'file:popnow.svg', dark: 'file:popnow.svg' },
            group: ['transform'],
            version: [1],
            subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
            description: 'Generate AI video, images, music and speech with Kling, Seedance, Wan, Nano Banana, Flux, Suno and more through PopNow (popnow.ai)',
            defaults: {
                name: 'PopNow',
            },
            usableAsTool: true,
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            credentials: [
                {
                    name: constants_1.CREDENTIAL_NAME,
                    required: true,
                },
            ],
            properties: [
                descriptions_1.resourceProperty,
                ...descriptions_1.operationProperties,
                descriptions_1.modelProperty,
                ...descriptions_1.inputProperties,
                ...descriptions_1.taskProperties,
                ...descriptions_1.fileProperties,
                ...descriptions_1.modelListProperties,
            ],
        };
        this.methods = { listSearch: methods_1.listSearch, loadOptions: methods_1.loadOptions, resourceMapping: methods_1.resourceMapping };
    }
    async execute() {
        var _a, _b, _c;
        const items = this.getInputData();
        const returnData = [];
        const run = (0, common_1.newRunContext)();
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const resource = this.getNodeParameter('resource', itemIndex);
                const operation = this.getNodeParameter('operation', itemIndex);
                const handler = OPERATIONS[`${resource}:${operation}`];
                if (!handler) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `The operation "${operation}" is not supported for "${resource}"`, { itemIndex });
                }
                const results = await handler.call(this, itemIndex, run);
                for (const result of results) {
                    returnData.push({ ...result, pairedItem: { item: itemIndex } });
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    const context = (_a = error.context) !== null && _a !== void 0 ? _a : {};
                    returnData.push({
                        json: {
                            error: error.message,
                            description: (_b = error.description) !== null && _b !== void 0 ? _b : null,
                            taskId: (_c = context.taskId) !== null && _c !== void 0 ? _c : null,
                        },
                        pairedItem: { item: itemIndex },
                    });
                    continue;
                }
                if (error instanceof n8n_workflow_1.NodeApiError) {
                    error.context.itemIndex = itemIndex;
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex });
                }
                if (error instanceof n8n_workflow_1.NodeOperationError) {
                    error.context.itemIndex = itemIndex;
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
                }
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [returnData];
    }
}
exports.PopNow = PopNow;
//# sourceMappingURL=PopNow.node.js.map