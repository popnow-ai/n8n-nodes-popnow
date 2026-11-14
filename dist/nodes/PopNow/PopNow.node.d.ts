import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class PopNow implements INodeType {
    description: INodeTypeDescription;
    methods: {
        listSearch: {
            searchModels(this: import("n8n-workflow").ILoadOptionsFunctions, filter?: string): Promise<import("n8n-workflow").INodeListSearchResult>;
        };
        loadOptions: {
            getMediaFields(this: import("n8n-workflow").ILoadOptionsFunctions): Promise<import("n8n-workflow").INodePropertyOptions[]>;
        };
        resourceMapping: {
            getModelParameters(this: import("n8n-workflow").ILoadOptionsFunctions): Promise<import("n8n-workflow").ResourceMapperFields>;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
