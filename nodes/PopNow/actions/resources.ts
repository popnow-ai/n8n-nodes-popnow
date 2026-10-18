import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { isSettledForOutput } from '../shared/task';
import { apiRequest, modelPath, uploadFile } from '../transport/api';
import type { RunContext } from './common';
import { downloadOutputs, getModelId, readBinary, waitDeadline, waitForTask } from './common';

// -- Task -----------------------------------------------------------------------

interface TaskOptions {
	binaryPropertyName?: string;
	downloadOutput?: boolean;
	maxWaitTime?: number;
	waitForCompletion?: boolean;
}

/** Task > Get: read a task, optionally wait for it and download its files. */
export async function getTask(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const taskId = String(this.getNodeParameter('taskId', itemIndex, '')).trim();
	if (!taskId) {
		throw new NodeOperationError(this.getNode(), 'Task ID is empty', { itemIndex });
	}
	const options = this.getNodeParameter('taskOptions', itemIndex, {}) as TaskOptions;
	let task = await apiRequest.call(
		this,
		'GET',
		'/api/v1/jobs/recordInfo',
		{ qs: { taskId } },
		itemIndex,
	);
	if (options.waitForCompletion === true && !isSettledForOutput(task)) {
		task = await waitForTask.call(
			this,
			taskId,
			waitDeadline(Number(options.maxWaitTime) || 0, task),
			itemIndex,
		);
	}
	if (options.downloadOutput === false || task.state !== 'succeeded') {
		return [{ json: task }];
	}
	const binaryBase = options.binaryPropertyName?.trim() || 'data';
	const binary = await downloadOutputs.call(this, task, binaryBase, itemIndex);
	return [{ json: task, binary }];
}

// -- File -------------------------------------------------------------------------

/** File > Upload: a binary from the incoming item becomes a popnow:// URI for task input. */
export async function uploadBinary(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const property =
		String(this.getNodeParameter('binaryPropertyName', itemIndex, 'data')).trim() || 'data';
	const options = this.getNodeParameter('fileOptions', itemIndex, {}) as { contentType?: string };
	const { data, contentType, fileName } = await readBinary.call(
		this,
		itemIndex,
		property,
		options.contentType,
	);
	const { uri, fileId, expiresAt } = await uploadFile.call(this, data, contentType, itemIndex);
	return [
		{
			json: {
				uri,
				fileId,
				fileName: fileName ?? null,
				mimeType: contentType,
				bytes: data.length,
				expiresAt: expiresAt ?? null,
			},
		},
	];
}

// -- Model ----------------------------------------------------------------------------

const LIST_FIELDS_DROPPED = new Set(['inputSchema', 'examples']);

/** Model > Get Many: the catalogue, with credit prices, filtered by modality and keyword. */
export async function getManyModels(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const modality = String(this.getNodeParameter('modality', itemIndex, 'all'));
	const search = String(this.getNodeParameter('search', itemIndex, '')).trim();
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = returnAll ? Infinity : Number(this.getNodeParameter('limit', itemIndex, 50));
	const data = await apiRequest.call(
		this,
		'GET',
		'/api/v1/models',
		{
			qs: {
				...(modality !== 'all' ? { modality } : {}),
				...(search ? { search } : {}),
			},
		},
		itemIndex,
	);
	const items = Array.isArray(data.items) ? (data.items as IDataObject[]) : [];
	return items
		.filter((item) => !!item && typeof item === 'object')
		.slice(0, limit)
		.map((item) => {
			const json: IDataObject = {};
			for (const [key, value] of Object.entries(item)) {
				if (!LIST_FIELDS_DROPPED.has(key)) {
					json[key] = value;
				}
			}
			return { json };
		});
}

/** Model > Get: one model with its input schema, examples and credit price. */
export async function getModel(
	this: IExecuteFunctions,
	itemIndex: number,
	run: RunContext,
): Promise<INodeExecutionData[]> {
	const modelId = getModelId.call(this, itemIndex);
	let pending = run.models.get(modelId);
	if (!pending) {
		pending = apiRequest.call(this, 'GET', modelPath(modelId), {}, itemIndex);
		run.models.set(modelId, pending);
	}
	return [{ json: await pending }];
}

// -- Account ------------------------------------------------------------------------------

/** Account > Get Balance: available, held and total, in credits and in US dollars. */
export async function getBalance(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const data = await apiRequest.call(this, 'GET', '/api/v1/chat/credit', {}, itemIndex);
	return [{ json: data }];
}
