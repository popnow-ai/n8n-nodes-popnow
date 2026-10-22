import type { INodeProperties } from 'n8n-workflow';

import { DEFAULT_MAX_CREDITS } from './shared/constants';

const MEDIA_RESOURCES = ['image', 'video', 'audio'];

const showForGenerate = { resource: MEDIA_RESOURCES, operation: ['generate'] };
/** Generate, plus Model > Get Quote, which prices the same input without running it. */
const showForInput = {
	resource: [...MEDIA_RESOURCES, 'model'],
	operation: ['generate', 'getQuote'],
};

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Account', value: 'account' },
		{ name: 'Audio', value: 'audio' },
		{ name: 'File', value: 'file' },
		{ name: 'Image', value: 'image' },
		{ name: 'Model', value: 'model' },
		{ name: 'Task', value: 'task' },
		{ name: 'Video', value: 'video' },
	],
	default: 'image',
};

const generateOperation = (resource: string, noun: string): INodeProperties => ({
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [resource] } },
	options: [
		{
			name: 'Generate',
			value: 'generate',
			description: `Generate ${noun} with a model, after checking its price`,
			action: `Generate ${noun}`,
		},
	],
	default: 'generate',
});

export const operationProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get Balance',
				value: 'getBalance',
				description: 'Get the available, held and total balance in credits and US dollars',
				action: 'Get the account balance',
			},
		],
		default: 'getBalance',
	},
	generateOperation('audio', 'audio'),
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['file'] } },
		options: [
			{
				name: 'Upload',
				value: 'upload',
				description: 'Upload a binary file and get a popnow:// URI to use as model input',
				action: 'Upload a file',
			},
		],
		default: 'upload',
	},
	generateOperation('image', 'an image'),
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['model'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a model with its input schema, examples and credit price',
				action: 'Get a model',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many models from the catalogue with their credit prices',
				action: 'Get many models',
			},
			{
				name: 'Get Quote',
				value: 'getQuote',
				description: 'Get the exact price of a request in credits without running it',
				action: 'Get a price quote',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['task'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a task, optionally waiting for it and downloading its files',
				action: 'Get a task',
			},
			{
				name: 'Retry',
				value: 'retry',
				description: 'Create a new task from a failed or expired task',
				action: 'Retry a task',
			},
		],
		default: 'get',
	},
	generateOperation('video', 'a video'),
];

export const modelProperty: INodeProperties = {
	displayName: 'Model',
	name: 'model',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description:
		'The model to use. The list shows the models of the selected resource with their price in credits.',
	displayOptions: {
		show: {
			resource: [...MEDIA_RESOURCES, 'model'],
			operation: ['generate', 'get', 'getQuote'],
		},
	},
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchModels',
				searchable: true,
			},
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. alibaba/z-image-turbo/text-to-image',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[A-Za-z0-9][A-Za-z0-9._-]*(/[A-Za-z0-9][A-Za-z0-9._-]*){1,4}$',
						errorMessage: 'Use a model ID such as alibaba/z-image-turbo/text-to-image',
					},
				},
			],
		},
	],
};

export const inputProperties: INodeProperties[] = [
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		placeholder: 'e.g. A lighthouse on a cliff at dusk, cinematic light',
		description:
			"The model's main text input: the prompt for most models, the text to speak for speech models. Leave it empty for models that take none, such as upscalers.",
		displayOptions: { show: showForInput },
	},
	{
		displayName: 'Media Inputs',
		name: 'mediaInputs',
		type: 'fixedCollection',
		placeholder: 'Add Media Input',
		typeOptions: { multipleValues: true },
		default: {},
		description:
			'Images, videos or audio the model reads. Binary files are uploaded to PopNow automatically. Add several inputs with the same field for list fields such as reference images.',
		displayOptions: { show: showForInput },
		options: [
			{
				displayName: 'Input',
				name: 'input',
				values: [
					{
						displayName: 'Field Name or ID',
						name: 'field',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getMediaFields',
							loadOptionsDependsOn: ['model.value'],
						},
						default: '',
						description:
							'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
					},
					{
						displayName: 'Source',
						name: 'source',
						type: 'options',
						options: [
							{
								name: 'Binary File',
								value: 'binary',
								description: 'A binary field of the incoming item',
							},
							{
								name: 'URL',
								value: 'url',
								description: 'A public link, or a popnow:// file or asset URI',
							},
						],
						default: 'binary',
					},
					{
						displayName: 'Input Binary Field',
						name: 'binaryProperty',
						type: 'string',
						default: 'data',
						hint: 'The name of the input binary field containing the file',
						displayOptions: { show: { source: ['binary'] } },
					},
					{
						displayName: 'URL',
						name: 'url',
						type: 'string',
						default: '',
						placeholder: 'e.g. https://example.com/photo.jpg',
						description:
							'A public https:// link, a popnow://f/ URI from File > Upload, or a popnow://a/ URI of a saved asset',
						displayOptions: { show: { source: ['url'] } },
					},
				],
			},
		],
	},
	{
		displayName: 'Model Parameters',
		name: 'modelParameters',
		type: 'resourceMapper',
		noDataExpression: true,
		default: { mappingMode: 'defineBelow', value: null },
		description:
			"The selected model's other parameters, generated from its schema. Fields left empty are not sent, so the model uses its own default.",
		displayOptions: { show: showForInput },
		typeOptions: {
			loadOptionsDependsOn: ['model.value'],
			resourceMapper: {
				resourceMapperMethod: 'getModelParameters',
				mode: 'add',
				valuesLabel: 'Parameters',
				fieldWords: { singular: 'parameter', plural: 'parameters' },
				addAllFields: true,
				supportAutoMap: false,
				multiKeyMatch: false,
				hideNoDataError: true,
				refreshStaleSchemaOnOpen: true,
			},
		},
	},
	{
		displayName: 'Additional Parameters (JSON)',
		name: 'additionalParameters',
		type: 'json',
		default: '{}',
		description:
			"Extra input fields as a JSON object. They override the fields above. Every field is listed on the model's page and in Model > Get.",
		displayOptions: { show: showForInput },
	},
	{
		displayName: 'Max Credits per Item',
		name: 'maxCredits',
		type: 'number',
		typeOptions: { minValue: 0, numberPrecision: 0 },
		default: DEFAULT_MAX_CREDITS,
		description:
			'Every item is priced in credits (1 credit = $0.001) before it runs. When the quote is higher than this, the node stops with an error and nothing is charged. 0 removes the limit.',
		displayOptions: { show: showForGenerate },
	},
	{
		displayName: 'Options',
		name: 'generateOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showForGenerate },
		options: [
			{
				displayName: 'Callback URL',
				name: 'callbackUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/webhook',
				description:
					'Public HTTPS URL that PopNow calls once the task finishes, for example the resume URL of a Wait node. Usually combined with Wait for Completion turned off.',
			},
			{
				displayName: 'Download Output',
				name: 'downloadOutput',
				type: 'boolean',
				default: true,
				description:
					'Whether to download the result files into binary fields. Without it only the links are returned, and they expire after about 20 minutes.',
			},
			{
				displayName: 'Max Wait Time (Seconds)',
				name: 'maxWaitTime',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description:
					"How long to wait for the result. 0 waits until the task's own deadline. The task keeps running after the node stops waiting.",
			},
			{
				displayName: 'Put Output in Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				hint: 'The name of the output binary field. More files go to data_1, data_2 and so on.',
			},
			{
				displayName: 'Retention (Seconds)',
				name: 'retentionSeconds',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description:
					"Delete this task's prompt and files sooner than the account default. 0 keeps the account default.",
			},
			{
				displayName: 'Wait for Completion',
				name: 'waitForCompletion',
				type: 'boolean',
				default: true,
				description:
					'Whether to wait for the result. When off, the node returns the task ID at once; fetch the result later with Task > Get.',
			},
		],
	},
];

export const taskProperties: INodeProperties[] = [
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. job_06gh1kjqt615nyydc4gqyd6nm4',
		description:
			'The ID returned when the task was created. Retry accepts a failed or expired task created with the same API key.',
		displayOptions: { show: { resource: ['task'], operation: ['get', 'retry'] } },
	},
	{
		displayName: 'Options',
		name: 'taskOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['task'], operation: ['get'] } },
		options: [
			{
				displayName: 'Download Output',
				name: 'downloadOutput',
				type: 'boolean',
				default: true,
				description: 'Whether to download the files of a succeeded task into binary fields',
			},
			{
				displayName: 'Max Wait Time (Seconds)',
				name: 'maxWaitTime',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description:
					"How long to wait when Wait for Completion is on. 0 waits until the task's own deadline.",
			},
			{
				displayName: 'Put Output in Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				hint: 'The name of the output binary field. More files go to data_1, data_2 and so on.',
			},
			{
				displayName: 'Wait for Completion',
				name: 'waitForCompletion',
				type: 'boolean',
				default: false,
				description:
					'Whether to wait until the task has finished instead of returning its current state',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'retryOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['task'], operation: ['retry'] } },
		options: [
			{
				displayName: 'Download Output',
				name: 'downloadOutput',
				type: 'boolean',
				default: true,
				description:
					'Whether to download the result files into binary fields. Without it only the links are returned, and they expire after about 20 minutes.',
			},
			{
				displayName: 'Max Wait Time (Seconds)',
				name: 'maxWaitTime',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description:
					"How long to wait for the result. 0 waits until the task's own deadline. The task keeps running after the node stops waiting.",
			},
			{
				displayName: 'Put Output in Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				hint: 'The name of the output binary field. More files go to data_1, data_2 and so on.',
			},
			{
				displayName: 'Wait for Completion',
				name: 'waitForCompletion',
				type: 'boolean',
				default: true,
				description:
					'Whether to wait for the new task to finish. When off, the node returns the new task ID at once.',
			},
		],
	},
];

export const fileProperties: INodeProperties[] = [
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the input binary field containing the file to upload',
		displayOptions: { show: { resource: ['file'], operation: ['upload'] } },
	},
	{
		displayName: 'Options',
		name: 'fileOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['file'], operation: ['upload'] } },
		options: [
			{
				displayName: 'Content Type',
				name: 'contentType',
				type: 'string',
				default: '',
				placeholder: 'e.g. image/png',
				description:
					'Overrides the MIME type of the binary. Accepted: JPEG, PNG, WebP and GIF images up to 10 MiB; MP4 and WebM video and MP3 and WAV audio up to 90 MiB.',
			},
		],
	},
];

export const modelListProperties: INodeProperties[] = [
	{
		displayName: 'Modality',
		name: 'modality',
		type: 'options',
		options: [
			{ name: 'All', value: 'all' },
			{ name: 'Audio', value: 'audio' },
			{ name: 'Image', value: 'image' },
			{ name: 'Video', value: 'video' },
		],
		default: 'all',
		description: 'Only return models of this kind',
		displayOptions: { show: { resource: ['model'], operation: ['getAll'] } },
	},
	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		placeholder: 'e.g. seedance',
		description: 'Only return models whose name or ID contains this text',
		displayOptions: { show: { resource: ['model'], operation: ['getAll'] } },
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['model'], operation: ['getAll'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['model'], operation: ['getAll'], returnAll: [false] } },
	},
];
