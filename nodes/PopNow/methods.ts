import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
	INodePropertyOptions,
	ResourceMapperFields,
} from 'n8n-workflow';

import { MODALITY_BY_RESOURCE } from './shared/constants';
import { formatCredits } from './shared/quote';
import type { ModelSchema } from './shared/schema';
import { mapperFields, mediaFields, promptFieldOf } from './shared/schema';
import { apiCall, apiError, apiRequest, modelPath } from './transport/api';

const UNIT_LABELS: Record<string, string> = {
	per_image: '/image',
	per_second: '/s',
	per_minute: '/min',
	per_request: '/request',
	per_video: '/video',
	per_1k_characters: '/1K chars',
};

function unitLabel(unit: unknown): string {
	if (typeof unit !== 'string' || !unit) {
		return '';
	}
	return UNIT_LABELS[unit] ?? ` ${unit.replace(/^per_/, 'per ').replace(/_/g, ' ')}`;
}

/** "from 10 credits/image" for the model picker, from the model's `credits` price. */
export function startingPriceText(model: IDataObject): string {
	const price = model.credits as IDataObject | undefined;
	if (!price || typeof price !== 'object' || typeof price.perUnit !== 'number') {
		return '';
	}
	return `from ${formatCredits(price.perUnit)}${unitLabel(price.unit)}`;
}

function matches(model: IDataObject, needle: string): boolean {
	if (!needle) {
		return true;
	}
	const haystack = [model.model, model.displayName, model.family, model.provider]
		.filter((value) => typeof value === 'string')
		.join(' ')
		.toLowerCase();
	return needle
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((word) => haystack.includes(word));
}

function currentModelId(context: ILoadOptionsFunctions): string {
	const value = context.getCurrentNodeParameter('model', { extractValue: true });
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * The selected model's input schema, or undefined while no valid model is chosen. Lookups run
 * while the user is still typing a model ID, so a miss is not an error worth showing.
 */
async function currentSchema(context: ILoadOptionsFunctions): Promise<ModelSchema | undefined> {
	const modelId = currentModelId(context);
	if (!modelId) {
		return undefined;
	}
	const result = await apiCall.call(context, 'GET', modelPath(modelId), { retry: false });
	if (!result.ok) {
		if (result.status === 404 || result.status === 400) {
			return undefined;
		}
		throw apiError(context, result);
	}
	return result.data.inputSchema as ModelSchema | undefined;
}

export const listSearch = {
	/** Models of the selected resource's modality, searchable by name, ID or maker. */
	async searchModels(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		const resource = String(this.getCurrentNodeParameter('resource') ?? '');
		const modality = MODALITY_BY_RESOURCE[resource];
		// The catalogue is not paginated and returns every match at once.
		const data = await apiRequest.call(this, 'GET', '/api/v1/models', {
			qs: modality ? { modality } : {},
		});
		const items = Array.isArray(data.items) ? (data.items as IDataObject[]) : [];
		const needle = (filter ?? '').trim();
		const results: INodeListSearchItems[] = items
			.filter((model) => model && model.enabled !== false && typeof model.model === 'string')
			.filter((model) => matches(model, needle))
			.map((model) => {
				const id = model.model as string;
				const price = startingPriceText(model);
				// The list only shows names, so the starting price goes into the name.
				const name = String(model.displayName || id);
				const item: INodeListSearchItems = {
					name: price ? `${name} (${price})` : name,
					value: id,
					description: id,
				};
				return item;
			});
		return { results };
	},
};

export const loadOptions = {
	/** The selected model's file inputs, for the Media Inputs "Field" list. */
	async getMediaFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const schema = await currentSchema(this);
		return mediaFields(schema).map((field) => {
			const kind = field.multiple ? `${field.kind} list` : field.kind;
			const required = field.required ? ', required' : '';
			return {
				name: `${field.label} (${kind}${required})`,
				value: field.name,
				description: field.description || field.name,
			};
		});
	},
};

export const resourceMapping = {
	/** Every other parameter of the selected model, as a form generated from its schema. */
	async getModelParameters(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
		const schema = await currentSchema(this);
		if (!schema) {
			return {
				fields: [],
				emptyFieldsNotice: 'Choose an existing model to see its parameters',
			};
		}
		const promptField = promptFieldOf(schema);
		const fields = mapperFields(schema, promptField ? [promptField] : []);
		return {
			fields,
			emptyFieldsNotice: 'This model has no parameters besides the prompt and media inputs',
		};
	},
};
