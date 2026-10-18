const MIME_ALIASES: Record<string, string> = {
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

const MIME_BY_EXTENSION: Record<string, string> = {
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

/**
 * The content type to declare when uploading a binary. n8n binaries often carry a loose or
 * generic MIME type ("image/jpg", "application/octet-stream"), so the file name is the fallback.
 */
export function normalizeContentType(mimeType: unknown, fileName?: unknown): string {
	const declared = typeof mimeType === 'string' ? mimeType.split(';')[0].trim().toLowerCase() : '';
	const aliased = MIME_ALIASES[declared] ?? declared;
	if (aliased && aliased !== 'application/octet-stream' && aliased.includes('/')) {
		return aliased;
	}
	if (typeof fileName === 'string') {
		const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
		if (MIME_BY_EXTENSION[extension]) {
			return MIME_BY_EXTENSION[extension];
		}
	}
	return aliased || 'application/octet-stream';
}
