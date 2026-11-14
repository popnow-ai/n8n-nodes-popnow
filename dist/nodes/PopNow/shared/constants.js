"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FALLBACK_TASK_TIMEOUT_SECONDS = exports.DEADLINE_GRACE_SECONDS = exports.POLL_FACTOR = exports.POLL_MAX_MS = exports.POLL_INITIAL_MS = exports.SERVER_WAIT_MODALITIES = exports.SERVER_WAIT_SECONDS = exports.DEFAULT_MAX_CREDITS = exports.MODALITY_BY_RESOURCE = exports.USER_AGENT = exports.PACKAGE_VERSION = exports.DEFAULT_BASE_URL = exports.CREDENTIAL_NAME = void 0;
exports.CREDENTIAL_NAME = 'popNowApi';
exports.DEFAULT_BASE_URL = 'https://api.popnow.ai';
exports.PACKAGE_VERSION = '0.1.1';
exports.USER_AGENT = `n8n-nodes-popnow/${exports.PACKAGE_VERSION} (+https://github.com/popnow-ai/n8n-nodes-popnow)`;
exports.MODALITY_BY_RESOURCE = {
    image: 'image',
    video: 'video',
    audio: 'audio',
    model: undefined,
};
exports.DEFAULT_MAX_CREDITS = 2000;
exports.SERVER_WAIT_SECONDS = 50;
exports.SERVER_WAIT_MODALITIES = new Set(['image', 'audio']);
exports.POLL_INITIAL_MS = 2000;
exports.POLL_MAX_MS = 10000;
exports.POLL_FACTOR = 1.5;
exports.DEADLINE_GRACE_SECONDS = 300;
exports.FALLBACK_TASK_TIMEOUT_SECONDS = 3600;
//# sourceMappingURL=constants.js.map