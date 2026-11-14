"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resourceMapping = exports.loadOptions = exports.listSearch = void 0;
exports.startingPriceText = startingPriceText;
const constants_1 = require("./shared/constants");
const quote_1 = require("./shared/quote");
const schema_1 = require("./shared/schema");
const api_1 = require("./transport/api");
const UNIT_LABELS = {
    per_image: '/image',
    per_second: '/s',
    per_minute: '/min',
    per_request: '/request',
    per_video: '/video',
    per_1k_characters: '/1K chars',
};
function unitLabel(unit) {
    var _a;
    if (typeof unit !== 'string' || !unit) {
        return '';
    }
    return (_a = UNIT_LABELS[unit]) !== null && _a !== void 0 ? _a : ` ${unit.replace(/^per_/, 'per ').replace(/_/g, ' ')}`;
}
function startingPriceText(model) {
    const price = model.credits;
    if (!price || typeof price !== 'object' || typeof price.perUnit !== 'number') {
        return '';
    }
    return `from ${(0, quote_1.formatCredits)(price.perUnit)}${unitLabel(price.unit)}`;
}
function matches(model, needle) {
    if (!needle) {
        return true;
    }
    const haystack = [model.model, model.displayName, model.family, model.provider]
        .filter((value) => typeof value === 'string')
        .join(' ')
        .toLowerCase();
    return needle
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((word) => haystack.includes(word));
}
function currentModelId(context) {
    const value = context.getCurrentNodeParameter('model', { extractValue: true });
    return typeof value === 'string' ? value.trim() : '';
}
async function currentSchema(context) {
    const modelId = currentModelId(context);
    if (!modelId) {
        return undefined;
    }
    const result = await api_1.apiCall.call(context, 'GET', (0, api_1.modelPath)(modelId), { retry: false });
    if (!result.ok) {
        if (result.status === 404 || result.status === 400) {
            return undefined;
        }
        throw (0, api_1.apiError)(context, result);
    }
    return result.data.inputSchema;
}
exports.listSearch = {
    async searchModels(filter) {
        var _a;
        const resource = String((_a = this.getCurrentNodeParameter('resource')) !== null && _a !== void 0 ? _a : '');
        const modality = constants_1.MODALITY_BY_RESOURCE[resource];
        const data = await api_1.apiRequest.call(this, 'GET', '/api/v1/models', {
            qs: modality ? { modality } : {},
        });
        const items = Array.isArray(data.items) ? data.items : [];
        const needle = (filter !== null && filter !== void 0 ? filter : '').trim();
        const results = items
            .filter((model) => model && model.enabled !== false && typeof model.model === 'string')
            .filter((model) => matches(model, needle))
            .map((model) => {
            const id = model.model;
            const price = startingPriceText(model);
            const name = String(model.displayName || id);
            const item = {
                name: price ? `${name} (${price})` : name,
                value: id,
                description: id,
            };
            return item;
        });
        return { results };
    },
};
exports.loadOptions = {
    async getMediaFields() {
        const schema = await currentSchema(this);
        return (0, schema_1.mediaFields)(schema).map((field) => {
            const kind = field.multiple ? `${field.kind} list` : field.kind;
            const required = field.required ? ', required' : '';
            return {
                name: `${field.label} (${kind}${required})`,
                value: field.name,
                description: field.description || field.name,
            };
        });
    },
};
exports.resourceMapping = {
    async getModelParameters() {
        const schema = await currentSchema(this);
        if (!schema) {
            return {
                fields: [],
                emptyFieldsNotice: 'Choose an existing model to see its parameters',
            };
        }
        const promptField = (0, schema_1.promptFieldOf)(schema);
        const fields = (0, schema_1.mapperFields)(schema, promptField ? [promptField] : []);
        return {
            fields,
            emptyFieldsNotice: 'This model has no parameters besides the prompt and media inputs',
        };
    },
};
//# sourceMappingURL=methods.js.map