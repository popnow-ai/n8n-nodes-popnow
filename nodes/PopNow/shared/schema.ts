import type {
	FieldType,
	IDataObject,
	INodePropertyOptions,
	ResourceMapperField,
} from 'n8n-workflow';

/**
 * Every PopNow model publishes a JSON Schema for its input, with presentation hints in a
 * per-property "x-ui" object (widget, order, advanced, enum_labels...). The same schema drives
 * the PopNow web forms, so mapping it faithfully keeps the node's form identical to what the model
 * accepts. Everything here is pure, so it is unit tested without n8n or a network.
 */

export interface PropertyUi {
	widget?: string;
	order?: number;
	advanced?: boolean;
	primary?: boolean;
	label?: string;
	unit?: string;
	accept?: string | string[];
	enum_labels?: Record<string, string>;
	[key: string]: unknown;
}

export interface SchemaProperty {
	type?: string | string[];
	enum?: unknown[];
	default?: unknown;
	description?: string;
	minimum?: number;
	maximum?: number;
	minItems?: number;
	maxItems?: number;
	contentMediaType?: string | string[];
	items?: SchemaProperty;
	'x-ui'?: PropertyUi;
	[key: string]: unknown;
}

export interface ModelSchema {
	type?: string;
	properties?: Record<string, SchemaProperty>;
	required?: string[];
	[key: string]: unknown;
}

export type MediaKind = 'image' | 'video' | 'audio' | 'file';

export interface MediaField {
	name: string;
	label: string;
	kind: MediaKind;
	multiple: boolean;
	required: boolean;
	accept: string[];
	maxItems?: number;
	description: string;
}

function uiOf(prop: SchemaProperty): PropertyUi {
	const ui = prop['x-ui'];
	return ui && typeof ui === 'object' ? ui : {};
}

function primaryType(prop: SchemaProperty): string {
	const value = prop.type;
	if (Array.isArray(value)) {
		const nonNull = value.filter((entry) => entry !== 'null');
		return nonNull.length === 1 ? nonNull[0] : 'mixed';
	}
	return typeof value === 'string' ? value : 'mixed';
}

function propertiesOf(schema: ModelSchema | undefined): Array<[string, SchemaProperty]> {
	const properties = schema?.properties;
	if (!properties || typeof properties !== 'object') {
		return [];
	}
	return Object.entries(properties).filter(
		(entry): entry is [string, SchemaProperty] => !!entry[1] && typeof entry[1] === 'object',
	);
}

function toList(value: unknown): string[] {
	if (typeof value === 'string') {
		return value
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean);
	}
	if (Array.isArray(value)) {
		return value.map((part) => String(part)).filter(Boolean);
	}
	return [];
}

/** "reference_image_urls" -> "Reference Images": labels follow the field, not the wire format. */
export function humanize(name: string): string {
	const stem = name
		.replace(/_urls$/, 's')
		.replace(/_url$/, '')
		.replace(/_/g, ' ')
		.trim();
	const words = (stem || name).split(/\s+/);
	return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function labelOf(name: string, prop: SchemaProperty): string {
	const label = uiOf(prop).label;
	return typeof label === 'string' && label.trim() ? label.trim() : humanize(name);
}

export function isMediaProperty(prop: SchemaProperty): boolean {
	const widget = uiOf(prop).widget;
	if (widget === 'upload' || widget === 'multi-upload') {
		return true;
	}
	return prop.contentMediaType !== undefined || prop.items?.contentMediaType !== undefined;
}

function mediaKind(types: string[], name: string): MediaKind {
	for (const kind of ['image', 'video', 'audio'] as const) {
		if (types.some((type) => type.startsWith(`${kind}/`))) {
			return kind;
		}
	}
	if (types.length > 0) {
		return 'file';
	}
	const lowered = name.toLowerCase();
	for (const kind of ['image', 'video', 'audio'] as const) {
		if (lowered.includes(kind)) {
			return kind;
		}
	}
	return 'file';
}

/** The file inputs of a model: images, videos, audio and documents it reads. */
export function mediaFields(schema: ModelSchema | undefined): MediaField[] {
	const required = new Set(schema?.required ?? []);
	const fields: MediaField[] = [];
	for (const [name, prop] of propertiesOf(schema)) {
		if (uiOf(prop).widget === 'hidden' || !isMediaProperty(prop)) {
			continue;
		}
		const multiple = primaryType(prop) === 'array';
		const declared = toList(multiple ? prop.items?.contentMediaType : prop.contentMediaType);
		const accept = Array.from(new Set([...declared, ...toList(uiOf(prop).accept)]));
		fields.push({
			name,
			label: labelOf(name, prop),
			kind: mediaKind(accept, name),
			multiple,
			required: required.has(name),
			accept,
			maxItems: multiple && typeof prop.maxItems === 'number' ? prop.maxItems : undefined,
			description: typeof prop.description === 'string' ? prop.description : '',
		});
	}
	return sortByOrder(fields, schema);
}

function sortByOrder<T extends { name: string }>(
	fields: T[],
	schema: ModelSchema | undefined,
): T[] {
	const properties = schema?.properties ?? {};
	const orderOf = (name: string): number => {
		const order = uiOf(properties[name] ?? {}).order;
		return typeof order === 'number' ? order : 0;
	};
	// x-ui.order is the only source of field order, highest first; ties keep schema order.
	return fields
		.map((field, index) => ({ field, index }))
		.sort((a, b) => orderOf(b.field.name) - orderOf(a.field.name) || a.index - b.index)
		.map(({ field }) => field);
}

/**
 * The field the node's "Prompt" box fills: `prompt` when the model has one, otherwise its main
 * free-text field (the text to speak, for speech models). Undefined when the model takes none.
 */
export function promptFieldOf(schema: ModelSchema | undefined): string | undefined {
	const entries = propertiesOf(schema);
	if (entries.some(([name]) => name === 'prompt')) {
		return 'prompt';
	}
	const textAreas = entries.filter(
		([, prop]) => uiOf(prop).widget === 'textarea' && primaryType(prop) === 'string',
	);
	const primary = textAreas.find(([, prop]) => uiOf(prop).primary === true);
	return (primary ?? textAreas[0])?.[0];
}

function isPrimitive(value: unknown): value is string | number | boolean {
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function rangeSuffix(prop: SchemaProperty): string {
	const { minimum, maximum } = prop;
	const unit = uiOf(prop).unit;
	const unitText = typeof unit === 'string' && unit.trim() ? ` ${unit.trim()}` : '';
	if (typeof minimum === 'number' && typeof maximum === 'number') {
		return ` (${minimum} to ${maximum}${unitText})`;
	}
	return unitText ? ` (${unitText.trim()})` : '';
}

function enumOptions(prop: SchemaProperty): INodePropertyOptions[] {
	const labels = uiOf(prop).enum_labels ?? {};
	const values = (prop.enum ?? []).filter(isPrimitive);
	const options = values.map((value) => ({
		name: String(labels[String(value)] ?? value),
		value,
	}));
	// Duplicate labels would make two choices indistinguishable; fall back to the raw values.
	if (new Set(options.map((option) => option.name)).size !== options.length) {
		return values.map((value) => ({ name: String(value), value }));
	}
	return options;
}

function fieldTypeOf(prop: SchemaProperty): FieldType {
	if (Array.isArray(prop.enum) && prop.enum.some(isPrimitive)) {
		return 'options';
	}
	switch (primaryType(prop)) {
		case 'boolean':
			return 'boolean';
		case 'integer':
		case 'number':
			return 'number';
		case 'array':
			return 'array';
		case 'object':
			return 'object';
		default:
			return 'string';
	}
}

/**
 * Resource mapper fields for every model parameter except the prompt and file inputs, which the
 * node collects in dedicated controls. Required fields always show; ordinary fields show with the
 * model's default filled in; advanced fields and switches without a default start hidden and can
 * be added from the "Add parameter" list.
 */
export function mapperFields(
	schema: ModelSchema | undefined,
	exclude: Iterable<string> = [],
): ResourceMapperField[] {
	const skip = new Set(exclude);
	const required = new Set(schema?.required ?? []);
	const fields: Array<{ name: string; field: ResourceMapperField }> = [];
	for (const [name, prop] of propertiesOf(schema)) {
		const ui = uiOf(prop);
		if (skip.has(name) || ui.widget === 'hidden' || isMediaProperty(prop)) {
			continue;
		}
		const type = fieldTypeOf(prop);
		const isRequired = required.has(name);
		const hasDefault = isPrimitive(prop.default);
		const startsHidden =
			!isRequired && (ui.advanced === true || (type === 'boolean' && !hasDefault));
		const field: ResourceMapperField = {
			id: name,
			displayName: `${labelOf(name, prop)}${type === 'number' ? rangeSuffix(prop) : ''}`,
			required: isRequired,
			defaultMatch: false,
			canBeUsedToMatch: false,
			display: true,
			type,
			removed: startsHidden,
		};
		if (type === 'options') {
			field.options = enumOptions(prop);
		}
		if (hasDefault && type !== 'array' && type !== 'object') {
			field.defaultValue = prop.default as string | number | boolean;
		}
		fields.push({ name, field });
	}
	return sortByOrder(fields, schema).map((entry) => entry.field);
}

/** Marks a value that must not be sent at all, so the model applies its own default. */
export const OMIT = Symbol('omit');

function looksLikeJson(text: string): boolean {
	const trimmed = text.trim();
	return (
		(trimmed.startsWith('{') && trimmed.endsWith('}')) ||
		(trimmed.startsWith('[') && trimmed.endsWith(']'))
	);
}

export function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch {
		return { ok: false };
	}
}

export class ParameterError extends Error {
	constructor(
		public readonly field: string,
		message: string,
	) {
		super(message);
		this.name = 'ParameterError';
	}
}

/**
 * Convert one value from the parameter form into what the API expects, or OMIT when the field
 * was left empty. Range checks are left to the API, whose error names the field.
 */
export function coerceParameter(
	name: string,
	prop: SchemaProperty | undefined,
	raw: unknown,
): unknown {
	if (raw === undefined || raw === null) {
		return OMIT;
	}
	if (typeof raw === 'string' && raw.trim() === '') {
		return OMIT;
	}
	if (!prop) {
		return raw;
	}
	const type = Array.isArray(prop.enum) && prop.enum.length > 0 ? 'enum' : primaryType(prop);
	switch (type) {
		case 'enum': {
			const match = (prop.enum ?? []).find((value) => String(value) === String(raw));
			return match === undefined ? raw : match;
		}
		case 'integer':
		case 'number': {
			if (typeof raw === 'number') {
				return raw;
			}
			const parsed = Number(String(raw).trim());
			if (!Number.isFinite(parsed)) {
				throw new ParameterError(name, `'${name}' must be a number, got "${String(raw)}"`);
			}
			return parsed;
		}
		case 'boolean': {
			if (typeof raw === 'boolean') {
				return raw;
			}
			const text = String(raw).trim().toLowerCase();
			if (text === 'true' || text === 'false') {
				return text === 'true';
			}
			throw new ParameterError(name, `'${name}' must be true or false, got "${String(raw)}"`);
		}
		case 'array':
		case 'object': {
			if (typeof raw !== 'string') {
				return raw;
			}
			const parsed = tryParseJson(raw);
			if (!parsed.ok) {
				throw new ParameterError(
					name,
					`'${name}' must be valid JSON (${type === 'array' ? 'a list' : 'an object'})`,
				);
			}
			return parsed.value;
		}
		case 'mixed': {
			if (typeof raw === 'string' && looksLikeJson(raw)) {
				const parsed = tryParseJson(raw);
				return parsed.ok ? parsed.value : raw;
			}
			return raw;
		}
		default:
			return typeof raw === 'string' ? raw : String(raw);
	}
}

export interface InputParts {
	schema?: ModelSchema;
	/** The node's Prompt box. */
	prompt?: string;
	/** Values from the resource mapper, keyed by field name. */
	parameters?: Record<string, unknown> | null;
	/** File inputs after upload: a URI per field, or a list for list fields. */
	media?: Record<string, string | string[]>;
	/** The JSON box: merged last, so it can override anything above. */
	extra?: IDataObject;
}

/** Assemble the `input` object of a task from the node's controls. */
export function buildInput(parts: InputParts): IDataObject {
	const input: IDataObject = {};
	const properties = parts.schema?.properties ?? {};

	const prompt = typeof parts.prompt === 'string' ? parts.prompt : '';
	if (prompt.trim() !== '') {
		const target = parts.schema ? promptFieldOf(parts.schema) : 'prompt';
		if (!target) {
			throw new ParameterError(
				'prompt',
				'This model takes no text prompt. Clear the Prompt field, or set its inputs under Model Parameters.',
			);
		}
		input[target] = prompt;
	}

	for (const [name, raw] of Object.entries(parts.parameters ?? {})) {
		const value = coerceParameter(name, properties[name], raw);
		if (value !== OMIT) {
			input[name] = value as IDataObject[string];
		}
	}

	for (const [name, value] of Object.entries(parts.media ?? {})) {
		input[name] = value;
	}

	for (const [name, value] of Object.entries(parts.extra ?? {})) {
		if (value === undefined) {
			continue;
		}
		input[name] = value;
	}
	return input;
}

/** Required file inputs that are still missing after the form and JSON were merged. */
export function missingRequiredMedia(
	schema: ModelSchema | undefined,
	input: IDataObject,
): MediaField[] {
	return mediaFields(schema).filter((field) => {
		if (!field.required) {
			return false;
		}
		const value = input[field.name];
		if (Array.isArray(value)) {
			return value.length === 0;
		}
		return typeof value !== 'string' || value.trim() === '';
	});
}
