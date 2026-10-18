'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { dist } = require('./helpers');
const { checkQuoteLimit, formatCredits, parseAmount, quoteCeiling, usdToCredits } = require(
	dist('nodes', 'PopNow', 'shared', 'quote.js'),
);

describe('checkQuoteLimit', () => {
	it('passes a quote under the limit', () => {
		assert.deepEqual(checkQuoteLimit({ maxCredits: 2, maxCharge: '0.02' }, 200), {
			ok: true,
			ceiling: 2,
		});
	});

	it('passes a quote exactly at the limit', () => {
		assert.equal(checkQuoteLimit({ maxCredits: 200 }, 200).ok, true);
	});

	it('stops a quote above the limit and says nothing was charged', () => {
		const result = checkQuoteLimit({ maxCredits: 240, maxCharge: '2.4' }, 200);
		assert.equal(result.ok, false);
		assert.match(result.message, /up to 240 credits/);
		assert.match(result.message, /limit of 200 credits/);
		assert.match(result.message, /Nothing was charged/);
	});

	it('uses maxCredits over the other amounts when present', () => {
		assert.equal(quoteCeiling({ maxCredits: 68, expectedCredits: 40, maxCharge: '0.10' }), 68);
		assert.equal(checkQuoteLimit({ maxCredits: 250, expectedCredits: 150 }, 200).ok, false);
	});

	it('falls back to the USD ceiling, converted to credits and rounded up', () => {
		assert.equal(quoteCeiling({ maxCharge: '0.68' }), 68);
		assert.equal(quoteCeiling({ estimatedCost: '0.015' }), 2);
		assert.equal(checkQuoteLimit({ maxCharge: '3' }, 200).ok, false);
		assert.equal(checkQuoteLimit({ estimatedCost: '0.5' }, 200).ok, true);
	});

	it('treats a limit of 0 as no limit', () => {
		assert.equal(checkQuoteLimit({ maxCredits: 25000 }, 0).ok, true);
	});

	it('fails closed when a limit is set but the quote has no price', () => {
		const result = checkQuoteLimit({}, 200);
		assert.equal(result.ok, false);
		assert.match(result.message, /could not be checked/);
	});
});

describe('formatCredits, parseAmount and usdToCredits', () => {
	it('formats singular and plural credits', () => {
		assert.equal(formatCredits(1), '1 credit');
		assert.equal(formatCredits(68), '68 credits');
		assert.equal(formatCredits('3'), '3 credits');
		assert.equal(formatCredits(undefined), 'an unknown number of credits');
	});

	it('parses numbers and decimal strings and rejects junk', () => {
		assert.equal(parseAmount('0.25'), 0.25);
		assert.equal(parseAmount(7), 7);
		assert.equal(parseAmount(''), undefined);
		assert.equal(parseAmount('abc'), undefined);
		assert.equal(parseAmount(null), undefined);
	});

	it('is not fooled by floating point noise', () => {
		assert.equal(usdToCredits(String(0.1 + 0.2)), 30);
		assert.equal(usdToCredits('0.68'), 68);
		assert.equal(usdToCredits('0.001'), 1);
	});
});
