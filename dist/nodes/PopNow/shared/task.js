"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_TERMINAL_STATES = exports.ACTIVE_STATES = void 0;
exports.isTerminal = isTerminal;
exports.outputAssets = outputAssets;
exports.outputText = outputText;
exports.hasPendingAssets = hasPendingAssets;
exports.isSettledForOutput = isSettledForOutput;
exports.extensionForMime = extensionForMime;
exports.binaryKeyFor = binaryKeyFor;
exports.taskFailureHint = taskFailureHint;
exports.ACTIVE_STATES = new Set(['queued', 'running']);
exports.KNOWN_TERMINAL_STATES = new Set(['succeeded', 'failed', 'expired', 'canceled']);
function isTerminal(state) {
    return typeof state === 'string' && state !== '' && !exports.ACTIVE_STATES.has(state);
}
function outputAssets(task) {
    const output = task.output;
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
        return [];
    }
    const assets = output.assets;
    if (!Array.isArray(assets)) {
        return [];
    }
    return assets.filter((asset) => !!asset && typeof asset === 'object' && !Array.isArray(asset));
}
function outputText(task) {
    const output = task.output;
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
        return undefined;
    }
    const text = output.text;
    return typeof text === 'string' ? text : undefined;
}
function hasPendingAssets(task) {
    if (task.state !== 'succeeded') {
        return false;
    }
    return outputAssets(task).some((asset) => asset.pending === true && asset.unavailable !== true);
}
function isSettledForOutput(task) {
    return isTerminal(task.state) && !hasPendingAssets(task);
}
const EXTENSION_BY_MIME = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/aac': 'aac',
    'audio/mp4': 'm4a',
    'text/plain': 'txt',
    'application/json': 'json',
};
function extensionForMime(mime) {
    var _a, _b;
    if (typeof mime !== 'string') {
        return 'bin';
    }
    const base = mime.split(';')[0].trim().toLowerCase();
    return (_a = EXTENSION_BY_MIME[base]) !== null && _a !== void 0 ? _a : (((_b = base.split('/')[1]) === null || _b === void 0 ? void 0 : _b.replace(/[^a-z0-9]/g, '')) || 'bin');
}
function binaryKeyFor(base, index) {
    return index === 0 ? base : `${base}_${index}`;
}
function taskFailureHint(errorCode) {
    switch (errorCode) {
        case 'content_rejected':
            return 'The model declined this request. Unless the model page says refusals are billed, nothing was charged.';
        case 'invalid_asset':
            return 'An input file could not be read. Check that links open without a login and that the file type matches the field.';
        case 'invalid_request':
            return 'The model rejected one of the inputs. Check the field named in the message against Model > Get.';
        case 'unsupported_combination':
            return 'No deployment serves this combination of parameters. Change the parameter named in the message, or pick another model.';
        case 'timeout':
            return 'The model did not finish in time. Nothing was charged; try again later.';
        case 'rate_limited':
        case 'upstream_unavailable':
        case 'upstream_failed':
        case 'generation_failed':
            return 'The generation did not complete and the held amount was released. Running the node again usually works.';
        default:
            return 'Failed and expired tasks are normally not charged; the task record shows cost and settled.';
    }
}
//# sourceMappingURL=task.js.map