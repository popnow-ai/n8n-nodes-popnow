import type { IDataObject, ILoadOptionsFunctions, INodeListSearchResult, INodePropertyOptions, ResourceMapperFields } from 'n8n-workflow';
export declare function startingPriceText(model: IDataObject): string;
export declare const listSearch: {
    searchModels(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult>;
};
export declare const loadOptions: {
    getMediaFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
};
export declare const resourceMapping: {
    getModelParameters(this: ILoadOptionsFunctions): Promise<ResourceMapperFields>;
};
