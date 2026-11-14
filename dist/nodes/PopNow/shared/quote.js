"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAmount = parseAmount;
exports.usdToCredits = usdToCredits;
exports.formatCredits = formatCredits;
exports.quoteCeiling = quoteCeiling;
exports.checkQuoteLimit = checkQuoteLimit;
function parseAmount(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}
function usdToCredits(value) {
    const usd = parseAmount(value);
    if (usd === undefined) {
        return undefined;
    }
    return Math.ceil(Math.round(usd * 1e6) / 1e3);
}
function formatCredits(value) {
    const amount = parseAmount(value);
    if (amount === undefined) {
        return 'an unknown number of credits';
    }
    return `${amount} ${amount === 1 ? 'credit' : 'credits'}`;
}
function quoteCeiling(quote) {
    var _a, _b, _c;
    return ((_c = (_b = (_a = parseAmount(quote.maxCredits)) !== null && _a !== void 0 ? _a : usdToCredits(quote.maxCharge)) !== null && _b !== void 0 ? _b : parseAmount(quote.expectedCredits)) !== null && _c !== void 0 ? _c : usdToCredits(quote.estimatedCost));
}
function checkQuoteLimit(quote, maxCredits) {
    const ceiling = quoteCeiling(quote);
    if (!(maxCredits > 0)) {
        return { ok: true, ceiling };
    }
    if (ceiling === undefined) {
        return {
            ok: false,
            ceiling: Number.NaN,
            message: 'PopNow did not return a price for this request, so the credit limit could not be checked. Nothing was charged.',
        };
    }
    if (ceiling > maxCredits) {
        return {
            ok: false,
            ceiling,
            message: `This item could cost up to ${formatCredits(ceiling)}, above the limit of ${formatCredits(maxCredits)} per item. Nothing was charged.`,
        };
    }
    return { ok: true, ceiling };
}
//# sourceMappingURL=quote.js.map