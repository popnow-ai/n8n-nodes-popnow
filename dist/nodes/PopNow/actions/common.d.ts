import type { IBinaryKeyData, IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { ModelSchema } from '../shared/schema';
export interface RunContext {
    models: Map<string, Promise<IDataObject>>;
}
export declare function newRunContext(): RunContext;
export declare function getModelId(this: IExecuteFunctions, itemIndex: number): string;
export declare function getModelDetail(this: IExecuteFunctions, modelId: string, run: RunContext, itemIndex: number): Promise<IDataObject>;
export declare function parseJsonObject(this: IExecuteFunctions, value: unknown, label: string, itemIndex: number): IDataObject;
export declare function uploadCached(this: IExecuteFunctions, data: Buffer, contentType: string, itemIndex: number): Promise<{
    uri: string;
    digest: string;
}>;
export declare function readBinary(this: IExecuteFunctions, itemIndex: number, propertyName: string, contentTypeOverride?: string): Promise<{
    data: Buffer;
    contentType: string;
    fileName?: string;
}>;
export interface CollectedInput {
    input: IDataObject;
    fingerprint: IDataObject;
}
export declare function collectInput(this: IExecuteFunctions, itemIndex: number, schema: ModelSchema | undefined): Promise<CollectedInput>;
export declare function quoteWithinLimit(this: IExecuteFunctions, itemIndex: number, modelId: string, input: IDataObject, maxCredits: number): Promise<IDataObject>;
export declare function keyFor(this: IExecuteFunctions, itemIndex: number, request: unknown): string;
export declare function waitDeadline(maxWaitSeconds: number, task: IDataObject, model?: IDataObject, now?: number): number;
export declare function waitForTask(this: IExecuteFunctions, taskId: string, deadlineMs: number, itemIndex: number): Promise<IDataObject>;
export declare function taskFailedError(this: IExecuteFunctions, task: IDataObject, itemIndex: number): NodeOperationError;
export declare function downloadOutputs(this: IExecuteFunctions, task: IDataObject, binaryBase: string, itemIndex: number): Promise<IBinaryKeyData>;
