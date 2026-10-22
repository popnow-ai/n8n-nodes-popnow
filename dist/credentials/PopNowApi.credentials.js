"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PopNowApi = void 0;
class PopNowApi {
    constructor() {
        this.name = 'popNowApi';
        this.displayName = 'PopNow API';
        this.icon = {
            light: 'file:../nodes/PopNow/popnow.svg',
            dark: 'file:../nodes/PopNow/popnow.svg',
        };
        this.documentationUrl = 'https://github.com/popnow-ai/n8n-nodes-popnow#credentials';
        this.properties = [
            {
                displayName: 'API Key',
                name: 'apiKey',
                type: 'string',
                typeOptions: { password: true },
                required: true,
                default: '',
                description: 'A key from https://popnow.ai/api/console/keys. It starts with sk-popnow-.',
            },
            {
                displayName: 'Base URL',
                name: 'baseUrl',
                type: 'string',
                default: 'https://api.popnow.ai',
                description: 'Leave as is unless PopNow support tells you otherwise',
            },
        ];
        this.authenticate = {
            type: 'generic',
            properties: {
                headers: {
                    Authorization: '=Bearer {{$credentials.apiKey}}',
                },
            },
        };
        this.test = {
            request: {
                baseURL: '={{$credentials.baseUrl}}',
                url: '/api/v1/chat/credit',
                method: 'GET',
                headers: {
                    'User-Agent': 'n8n-nodes-popnow/0.1.1 (+https://github.com/popnow-ai/n8n-nodes-popnow)',
                },
            },
        };
    }
}
exports.PopNowApi = PopNowApi;
//# sourceMappingURL=PopNowApi.credentials.js.map