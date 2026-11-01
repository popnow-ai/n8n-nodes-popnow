"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalJson = canonicalJson;
exports.sha256Hex = sha256Hex;
exports.idempotencyKey = idempotencyKey;
const crypto_1 = require("crypto");
function canonicalJson(value) {
    return JSON.stringify(sortKeys(value));
}
function sortKeys(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => (entry === undefined ? null : sortKeys(entry)));
    }
    if (value !== null && typeof value === 'object') {
        const source = value;
        const sorted = {};
        for (const key of Object.keys(source).sort()) {
            if (source[key] !== undefined) {
                sorted[key] = sortKeys(source[key]);
            }
        }
        return sorted;
    }
    return value;
}
function sha256Hex(data) {
    return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
}
function idempotencyKey(parts) {
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
//# sourceMappingURL=idempotency.js.map