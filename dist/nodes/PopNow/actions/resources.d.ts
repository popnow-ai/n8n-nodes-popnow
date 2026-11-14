import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import type { RunContext } from './common';
export declare function getTask(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]>;
export declare function uploadBinary(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]>;
export declare function getManyModels(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]>;
export declare function getModel(this: IExecuteFunctions, itemIndex: number, run: RunContext): Promise<INodeExecutionData[]>;
export declare function getBalance(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]>;
