"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeContentType = normalizeContentType;
const MIME_ALIASES = {
    'image/jpg': 'image/jpeg',
    'image/pjpeg': 'image/jpeg',
    'audio/mp3': 'audio/mpeg',
    'audio/x-mp3': 'audio/mpeg',
    'audio/mpeg3': 'audio/mpeg',
    'audio/x-wav': 'audio/wav',
    'audio/wave': 'audio/wav',
    'audio/vnd.wave': 'audio/wav',
    'video/mov': 'video/quicktime',
    'video/x-quicktime': 'video/quicktime',
};
const MIME_BY_EXTENSION = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
};
function normalizeContentType(mimeType, fileName) {
    var _a, _b, _c;
    const declared = typeof mimeType === 'string' ? mimeType.split(';')[0].trim().toLowerCase() : '';
    const aliased = (_a = MIME_ALIASES[declared]) !== null && _a !== void 0 ? _a : declared;
    if (aliased && aliased !== 'application/octet-stream' && aliased.includes('/')) {
        return aliased;
    }
    if (typeof fileName === 'string') {
        const extension = (_c = (_b = fileName.split('.').pop()) === null || _b === void 0 ? void 0 : _b.toLowerCase()) !== null && _c !== void 0 ? _c : '';
        if (MIME_BY_EXTENSION[extension]) {
            return MIME_BY_EXTENSION[extension];
        }
    }
    return aliased || 'application/octet-stream';
}
//# sourceMappingURL=media.js.map