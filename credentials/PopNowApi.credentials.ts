import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/** API key credential for PopNow (popnow.ai). */
export class PopNowApi implements ICredentialType {
	name = 'popNowApi';

	displayName = 'PopNow API';

	icon: Icon = {
		light: 'file:../nodes/PopNow/popnow.svg',
		dark: 'file:../nodes/PopNow/popnow.svg',
	};

	documentationUrl = 'https://github.com/popnow-ai/n8n-nodes-popnow#credentials';

	properties: INodeProperties[] = [
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

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// Reading the balance is authenticated and free, so saving the credential checks the key.
	test: ICredentialTestRequest = {
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
