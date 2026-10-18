'use strict';

// Repository hygiene: every tracked text file must be English and free of names that do not
// belong in this public package. A counter-check makes sure the scan really read the files, so
// the test cannot pass just because nothing was found to scan.

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const root = path.join(__dirname, '..');

// Han, Hiragana/Katakana and Hangul syllables, written as escapes so this file stays ASCII.
const CJK = new RegExp('[\\u4e00-\\u9fff\\u3040-\\u30ff\\uac00-\\ud7af]');

// Built from fragments so this file does not match its own patterns.
const BLOCKED = new RegExp(
	[
		['sp', 'icy'],
		['wave', 'speed'],
		['atlas', 'cloud'],
		['k', 'ie\\.ai'],
		['\\bk', 'ie\\b'],
		['ns', 'fw'],
		['uncen', 'sored'],
		['foun', 'dation/'],
	]
		.map((parts) => parts.join(''))
		.join('|'),
	'i',
);

function trackedTextFiles() {
	const output = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
	return output
		.split('\0')
		.filter(Boolean)
		.map((file) => ({ file, data: fs.readFileSync(path.join(root, file)) }))
		.filter(({ data }) => !data.includes(0));
}

describe('repository guard', () => {
	const files = trackedTextFiles();

	it('reads enough tracked files for the scan to mean something', () => {
		assert.ok(files.length >= 20, `only ${files.length} tracked text files were read`);
		const bytes = files.reduce((sum, { data }) => sum + data.length, 0);
		assert.ok(bytes > 50_000, `only ${bytes} bytes were read`);
		assert.ok(files.some(({ file }) => file === 'README.md'));
	});

	it('has no CJK characters in any tracked file', () => {
		const offenders = files
			.filter(({ data }) => CJK.test(data.toString('utf8')))
			.map(({ file }) => file);
		assert.deepEqual(offenders, []);
	});

	it('has no blocked names in any tracked file', () => {
		const offenders = files
			.filter(({ data }) => BLOCKED.test(data.toString('utf8')))
			.map(({ file }) => file);
		assert.deepEqual(offenders, []);
	});

	it('detects a planted sample, so the patterns are live', () => {
		assert.ok(CJK.test(String.fromCharCode(0x6587)));
		assert.ok(BLOCKED.test(['wave', 'speed'].join('')));
	});
});
