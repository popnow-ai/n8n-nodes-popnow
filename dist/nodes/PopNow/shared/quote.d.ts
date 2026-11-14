export declare function parseAmount(value: unknown): number | undefined;
export declare function usdToCredits(value: unknown): number | undefined;
export declare function formatCredits(value: unknown): string;
export interface QuoteLike {
    maxCredits?: unknown;
    expectedCredits?: unknown;
    maxCharge?: unknown;
    estimatedCost?: unknown;
    quoteId?: unknown;
}
export declare function quoteCeiling(quote: QuoteLike): number | undefined;
export type QuoteCheck = {
    ok: true;
    ceiling?: number;
} | {
    ok: false;
    ceiling: number;
    message: string;
};
export declare function checkQuoteLimit(quote: QuoteLike, maxCredits: number): QuoteCheck;
