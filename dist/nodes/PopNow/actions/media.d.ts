import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import type { RunContext } from './common';
export declare function generate(this: IExecuteFunctions, itemIndex: number, run: RunContext): Promise<INodeExecutionData[]>;
export declare function getQuote(this: IExecuteFunctions, itemIndex: number, run: RunContext): Promise<INodeExecutionData[]>;
export declare function retryTask(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]>;
