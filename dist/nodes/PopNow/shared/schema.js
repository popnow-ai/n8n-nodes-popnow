"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParameterError = exports.OMIT = void 0;
exports.humanize = humanize;
exports.isMediaProperty = isMediaProperty;
exports.mediaFields = mediaFields;
exports.promptFieldOf = promptFieldOf;
exports.mapperFields = mapperFields;
exports.tryParseJson = tryParseJson;
exports.coerceParameter = coerceParameter;
exports.buildInput = buildInput;
exports.missingRequiredMedia = missingRequiredMedia;
function uiOf(prop) {
    const ui = prop['x-ui'];
    return ui && typeof ui === 'object' ? ui : {};
}
function primaryType(prop) {
    const value = prop.type;
    if (Array.isArray(value)) {
        const nonNull = value.filter((entry) => entry !== 'null');
        return nonNull.length === 1 ? nonNull[0] : 'mixed';
    }
    return typeof value === 'string' ? value : 'mixed';
}
function propertiesOf(schema) {
    const properties = schema === null || schema === void 0 ? void 0 : schema.properties;
    if (!properties || typeof properties !== 'object') {
        return [];
    }
    return Object.entries(properties).filter((entry) => !!entry[1] && typeof entry[1] === 'object');
}
function toList(value) {
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
    }
    if (Array.isArray(value)) {
        return value.map((part) => String(part)).filter(Boolean);
    }
    return [];
}
function humanize(name) {
    const stem = name
        .replace(/_urls$/, 's')
        .replace(/_url$/, '')
        .replace(/_/g, ' ')
        .trim();
    const words = (stem || name).split(/\s+/);
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
function labelOf(name, prop) {
    const label = uiOf(prop).label;
    return typeof label === 'string' && label.trim() ? label.trim() : humanize(name);
}
function isMediaProperty(prop) {
    var _a;
    const widget = uiOf(prop).widget;
    if (widget === 'upload' || widget === 'multi-upload') {
        return true;
    }
    return prop.contentMediaType !== undefined || ((_a = prop.items) === null || _a === void 0 ? void 0 : _a.contentMediaType) !== undefined;
}
function mediaKind(types, name) {
    for (const kind of ['image', 'video', 'audio']) {
        if (types.some((type) => type.startsWith(`${kind}/`))) {
            return kind;
        }
    }
    if (types.length > 0) {
        return 'file';
    }
    const lowered = name.toLowerCase();
    for (const kind of ['image', 'video', 'audio']) {
        if (lowered.includes(kind)) {
            return kind;
        }
    }
    return 'file';
}
function mediaFields(schema) {
    var _a, _b;
    const required = new Set((_a = schema === null || schema === void 0 ? void 0 : schema.required) !== null && _a !== void 0 ? _a : []);
    const fields = [];
    for (const [name, prop] of propertiesOf(schema)) {
        if (uiOf(prop).widget === 'hidden' || !isMediaProperty(prop)) {
            continue;
        }
        const multiple = primaryType(prop) === 'array';
        const declared = toList(multiple ? (_b = prop.items) === null || _b === void 0 ? void 0 : _b.contentMediaType : prop.contentMediaType);
        const accept = Array.from(new Set([...declared, ...toList(uiOf(prop).accept)]));
        fields.push({
            name,
            label: labelOf(name, prop),
            kind: mediaKind(accept, name),
            multiple,
            required: required.has(name),
            accept,
            maxItems: multiple && typeof prop.maxItems === 'number' ? prop.maxItems : undefined,
            description: typeof prop.description === 'string' ? prop.description : '',
        });
    }
    return sortByOrder(fields, schema);
}
function sortByOrder(fields, schema) {
    var _a;
    const properties = (_a = schema === null || schema === void 0 ? void 0 : schema.properties) !== null && _a !== void 0 ? _a : {};
    const orderOf = (name) => {
        var _a;
        const order = uiOf((_a = properties[name]) !== null && _a !== void 0 ? _a : {}).order;
        return typeof order === 'number' ? order : 0;
    };
    return fields
        .map((field, index) => ({ field, index }))
        .sort((a, b) => orderOf(b.field.name) - orderOf(a.field.name) || a.index - b.index)
        .map(({ field }) => field);
}
function promptFieldOf(schema) {
    var _a;
    const entries = propertiesOf(schema);
    if (entries.some(([name]) => name === 'prompt')) {
        return 'prompt';
    }
    const textAreas = entries.filter(([, prop]) => uiOf(prop).widget === 'textarea' && primaryType(prop) === 'string');
    const primary = textAreas.find(([, prop]) => uiOf(prop).primary === true);
    return (_a = (primary !== null && primary !== void 0 ? primary : textAreas[0])) === null || _a === void 0 ? void 0 : _a[0];
}
function isPrimitive(value) {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
function rangeSuffix(prop) {
    const { minimum, maximum } = prop;
    const unit = uiOf(prop).unit;
    const unitText = typeof unit === 'string' && unit.trim() ? ` ${unit.trim()}` : '';
    if (typeof minimum === 'number' && typeof maximum === 'number') {
        return ` (${minimum} to ${maximum}${unitText})`;
    }
    return unitText ? ` (${unitText.trim()})` : '';
}
function enumOptions(prop) {
    var _a, _b;
    const labels = (_a = uiOf(prop).enum_labels) !== null && _a !== void 0 ? _a : {};
    const values = ((_b = prop.enum) !== null && _b !== void 0 ? _b : []).filter(isPrimitive);
    const options = values.map((value) => {
        var _a;
        return ({
            name: String((_a = labels[String(value)]) !== null && _a !== void 0 ? _a : value),
            value,
        });
    });
    if (new Set(options.map((option) => option.name)).size !== options.length) {
        return values.map((value) => ({ name: String(value), value }));
    }
    return options;
}
function fieldTypeOf(prop) {
    if (Array.isArray(prop.enum) && prop.enum.some(isPrimitive)) {
        return 'options';
    }
    switch (primaryType(prop)) {
        case 'boolean':
            return 'boolean';
        case 'integer':
        case 'number':
            return 'number';
        case 'array':
            return 'array';
        case 'object':
            return 'object';
        default:
            return 'string';
    }
}
function mapperFields(schema, exclude = []) {
    var _a;
    const skip = new Set(exclude);
    const required = new Set((_a = schema === null || schema === void 0 ? void 0 : schema.required) !== null && _a !== void 0 ? _a : []);
    const fields = [];
    for (const [name, prop] of propertiesOf(schema)) {
        const ui = uiOf(prop);
        if (skip.has(name) || ui.widget === 'hidden' || isMediaProperty(prop)) {
            continue;
        }
        const type = fieldTypeOf(prop);
        const isRequired = required.has(name);
        const hasDefault = isPrimitive(prop.default);
        const startsHidden = !isRequired && (ui.advanced === true || (type === 'boolean' && !hasDefault));
        const field = {
            id: name,
            displayName: `${labelOf(name, prop)}${type === 'number' ? rangeSuffix(prop) : ''}`,
            required: isRequired,
            defaultMatch: false,
            canBeUsedToMatch: false,
            display: true,
            type,
            removed: startsHidden,
        };
        if (type === 'options') {
            field.options = enumOptions(prop);
        }
        if (hasDefault && type !== 'array' && type !== 'object') {
            field.defaultValue = prop.default;
        }
        fields.push({ name, field });
    }
    return sortByOrder(fields, schema).map((entry) => entry.field);
}
exports.OMIT = Symbol('omit');
function looksLikeJson(text) {
    const trimmed = text.trim();
    return ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']')));
}
function tryParseJson(text) {
    try {
        return { ok: true, value: JSON.parse(text) };
    }
    catch {
        return { ok: false };
    }
}
class ParameterError extends Error {
    constructor(field, message) {
        super(message);
        this.field = field;
        this.name = 'ParameterError';
    }
}
exports.ParameterError = ParameterError;
function coerceParameter(name, prop, raw) {
    var _a;
    if (raw === undefined || raw === null) {
        return exports.OMIT;
    }
    if (typeof raw === 'string' && raw.trim() === '') {
        return exports.OMIT;
    }
    if (!prop) {
        return raw;
    }
    const type = Array.isArray(prop.enum) && prop.enum.length > 0 ? 'enum' : primaryType(prop);
    switch (type) {
        case 'enum': {
            const match = ((_a = prop.enum) !== null && _a !== void 0 ? _a : []).find((value) => String(value) === String(raw));
            return match === undefined ? raw : match;
        }
        case 'integer':
        case 'number': {
            if (typeof raw === 'number') {
                return raw;
            }
            const parsed = Number(String(raw).trim());
            if (!Number.isFinite(parsed)) {
                throw new ParameterError(name, `'${name}' must be a number, got "${String(raw)}"`);
            }
            return parsed;
        }
        case 'boolean': {
            if (typeof raw === 'boolean') {
                return raw;
            }
            const text = String(raw).trim().toLowerCase();
            if (text === 'true' || text === 'false') {
                return text === 'true';
            }
            throw new ParameterError(name, `'${name}' must be true or false, got "${String(raw)}"`);
        }
        case 'array':
        case 'object': {
            if (typeof raw !== 'string') {
                return raw;
            }
            const parsed = tryParseJson(raw);
            if (!parsed.ok) {
                throw new ParameterError(name, `'${name}' must be valid JSON (${type === 'array' ? 'a list' : 'an object'})`);
            }
            return parsed.value;
        }
        case 'mixed': {
            if (typeof raw === 'string' && looksLikeJson(raw)) {
                const parsed = tryParseJson(raw);
                return parsed.ok ? parsed.value : raw;
            }
            return raw;
        }
        default:
            return typeof raw === 'string' ? raw : String(raw);
    }
}
function buildInput(parts) {
    var _a, _b, _c, _d, _e;
    const input = {};
    const properties = (_b = (_a = parts.schema) === null || _a === void 0 ? void 0 : _a.properties) !== null && _b !== void 0 ? _b : {};
    const prompt = typeof parts.prompt === 'string' ? parts.prompt : '';
    if (prompt.trim() !== '') {
        const target = parts.schema ? promptFieldOf(parts.schema) : 'prompt';
        if (!target) {
            throw new ParameterError('prompt', 'This model takes no text prompt. Clear the Prompt field, or set its inputs under Model Parameters.');
        }
        input[target] = prompt;
    }
    for (const [name, raw] of Object.entries((_c = parts.parameters) !== null && _c !== void 0 ? _c : {})) {
        const value = coerceParameter(name, properties[name], raw);
        if (value !== exports.OMIT) {
            input[name] = value;
        }
    }
    for (const [name, value] of Object.entries((_d = parts.media) !== null && _d !== void 0 ? _d : {})) {
        input[name] = value;
    }
    for (const [name, value] of Object.entries((_e = parts.extra) !== null && _e !== void 0 ? _e : {})) {
        if (value === undefined) {
            continue;
        }
        input[name] = value;
    }
    return input;
}
function missingRequiredMedia(schema, input) {
    return mediaFields(schema).filter((field) => {
        if (!field.required) {
            return false;
        }
        const value = input[field.name];
        if (Array.isArray(value)) {
            return value.length === 0;
        }
        return typeof value !== 'string' || value.trim() === '';
    });
}
//# sourceMappingURL=schema.js.map