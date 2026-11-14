import type { IDataObject, IExecuteFunctions, IHttpRequestMethods, ILoadOptionsFunctions } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
export type ApiContext = IExecuteFunctions | ILoadOptionsFunctions;
export declare const RECOVERY_BY_CODE: Record<number, string>;
export interface ApiCallOptions {
    qs?: IDataObject;
    body?: IDataObject;
    headers?: IDataObject;
    timeoutMs?: number;
    retry?: boolean;
    retryConflictOnce?: boolean;
}
export interface ApiResult {
    ok: boolean;
    status: number;
    code?: number;
    message: string;
    requestId: string;
    data: IDataObject;
    headers: IDataObject;
}
export declare function cancelSignal(context: ApiContext): AbortSignal | undefined;
export declare function cancellableSleep(context: ApiContext, ms: number): Promise<boolean>;
export declare function resolveBaseUrl(this: ApiContext): Promise<string>;
export declare function accountFingerprint(this: ApiContext): Promise<string>;
export declare function apiCall(this: ApiContext, method: IHttpRequestMethods, path: string, options?: ApiCallOptions): Promise<ApiResult>;
export declare function apiError(context: ApiContext, result: ApiResult, itemIndex?: number): NodeApiError;
export declare function apiRequest(this: ApiContext, method: IHttpRequestMethods, path: string, options?: ApiCallOptions, itemIndex?: number): Promise<IDataObject>;
export declare function modelPath(modelId: string): string;
export declare function uploadFile(this: IExecuteFunctions, data: Buffer, contentType: string, itemIndex?: number): Promise<{
    uri: string;
    fileId: string;
    expiresAt?: string;
}>;
export declare function downloadFile(this: IExecuteFunctions, url: string, itemIndex?: number): Promise<{
    data: Buffer;
    contentType: string;
}>;
