import type { IDataObject, ResourceMapperField } from 'n8n-workflow';
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
export declare function humanize(name: string): string;
export declare function isMediaProperty(prop: SchemaProperty): boolean;
export declare function mediaFields(schema: ModelSchema | undefined): MediaField[];
export declare function promptFieldOf(schema: ModelSchema | undefined): string | undefined;
export declare function mapperFields(schema: ModelSchema | undefined, exclude?: Iterable<string>): ResourceMapperField[];
export declare const OMIT: unique symbol;
export declare function tryParseJson(text: string): {
    ok: true;
    value: unknown;
} | {
    ok: false;
};
export declare class ParameterError extends Error {
    readonly field: string;
    constructor(field: string, message: string);
}
export declare function coerceParameter(name: string, prop: SchemaProperty | undefined, raw: unknown): unknown;
export interface InputParts {
    schema?: ModelSchema;
    prompt?: string;
    parameters?: Record<string, unknown> | null;
    media?: Record<string, string | string[]>;
    extra?: IDataObject;
}
export declare function buildInput(parts: InputParts): IDataObject;
export declare function missingRequiredMedia(schema: ModelSchema | undefined, input: IDataObject): MediaField[];
