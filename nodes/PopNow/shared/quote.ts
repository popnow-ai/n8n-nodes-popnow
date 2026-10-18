/**
 * Prices on PopNow are in credits (1 credit = $0.01). The API returns every amount both as an
 * integer number of credits (`maxCredits`, `estimatedCredits`, `credits`) and as the same amount
 * in US dollars as a decimal string (`maxCharge`, `estimatedCost`, `cost`).
 */

/** A finite number from a number or a decimal string, otherwise undefined. */
export function parseAmount(value: unknown): number | undefined {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : undefined;
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

/** A USD amount converted to credits, rounded up so a limit check never under-counts. */
export function usdToCredits(value: unknown): number | undefined {
	const usd = parseAmount(value);
	if (usd === undefined) {
		return undefined;
	}
	// Round to micro-dollars first so float noise ("0.68" -> 67.99999) does not add a credit.
	return Math.ceil(Math.round(usd * 1e6) / 1e4);
}

/** "1 credit", "68 credits". */
export function formatCredits(value: unknown): string {
	const amount = parseAmount(value);
	if (amount === undefined) {
		return 'an unknown number of credits';
	}
	return `${amount} ${amount === 1 ? 'credit' : 'credits'}`;
}

export interface QuoteLike {
	maxCredits?: unknown;
	expectedCredits?: unknown;
	maxCharge?: unknown;
	estimatedCost?: unknown;
	quoteId?: unknown;
}

/**
 * The most this request can cost, in credits: `maxCredits` when present, otherwise the USD
 * ceiling converted to credits.
 */
export function quoteCeiling(quote: QuoteLike): number | undefined {
	return (
		parseAmount(quote.maxCredits) ??
		usdToCredits(quote.maxCharge) ??
		parseAmount(quote.expectedCredits) ??
		usdToCredits(quote.estimatedCost)
	);
}

export type QuoteCheck =
	| { ok: true; ceiling?: number }
	| { ok: false; ceiling: number; message: string };

/**
 * Compare a quote with the per-item limit before anything is created. A limit of 0 (or less)
 * means "no limit". A quote without any amount is treated as over the limit when a limit is set:
 * the guard exists to stop unexpected spend, so it fails closed.
 */
export function checkQuoteLimit(quote: QuoteLike, maxCredits: number): QuoteCheck {
	const ceiling = quoteCeiling(quote);
	if (!(maxCredits > 0)) {
		return { ok: true, ceiling };
	}
	if (ceiling === undefined) {
		return {
			ok: false,
			ceiling: Number.NaN,
			message:
				'PopNow did not return a price for this request, so the credit limit could not be checked. Nothing was charged.',
		};
	}
	if (ceiling > maxCredits) {
		return {
			ok: false,
			ceiling,
			message: `This item could cost up to ${formatCredits(ceiling)}, above the limit of ${formatCredits(
				maxCredits,
			)} per item. Nothing was charged.`,
		};
	}
	return { ok: true, ceiling };
}
