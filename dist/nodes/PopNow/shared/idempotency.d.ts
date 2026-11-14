export declare function canonicalJson(value: unknown): string;
export declare function sha256Hex(data: string | Buffer): string;
export interface IdempotencyParts {
    executionId: string;
    nodeId: string;
    runIndex: number;
    itemIndex: number;
    request: unknown;
}
export declare function idempotencyKey(parts: IdempotencyParts): string;
