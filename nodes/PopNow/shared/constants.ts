export const CREDENTIAL_NAME = 'popNowApi';

export const DEFAULT_BASE_URL = 'https://api.popnow.ai';

/** Kept in step with package.json by a unit test. */
export const PACKAGE_VERSION = '0.1.1';

/** The API rejects generic client User-Agents, so every request names this package. */
export const USER_AGENT = `n8n-nodes-popnow/${PACKAGE_VERSION} (+https://github.com/popnow-ai/n8n-nodes-popnow)`;

/** The modality each node resource lists in its model picker. */
export const MODALITY_BY_RESOURCE: Record<string, string | undefined> = {
	image: 'image',
	video: 'video',
	audio: 'audio',
	model: undefined,
};

/** Default per-item limit, in credits (1 credit = $0.001, so 2,000 credits = $2). */
export const DEFAULT_MAX_CREDITS = 2000;

/** createTask may hold the connection until the task is done; the API clamps this at 60. */
export const SERVER_WAIT_SECONDS = 50;

/** Modalities whose models usually finish within SERVER_WAIT_SECONDS. */
export const SERVER_WAIT_MODALITIES = new Set(['image', 'audio']);

export const POLL_INITIAL_MS = 2000;
export const POLL_MAX_MS = 10000;
export const POLL_FACTOR = 1.5;

/** Grace period after a task's own deadline before the node stops waiting. */
export const DEADLINE_GRACE_SECONDS = 300;
export const FALLBACK_TASK_TIMEOUT_SECONDS = 3600;
