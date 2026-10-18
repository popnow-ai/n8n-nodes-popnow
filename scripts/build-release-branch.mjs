// Prepares the contents of the `release` branch: exactly the files `npm pack` puts in the
// package (built dist/, README, LICENSE, CHANGELOG), with a package.json that has no scripts and
// no devDependencies. npm then installs `github:popnow-ai/n8n-nodes-popnow#release` as-is,
// without cloning the dev tooling or running any build step on the user's machine.
//
// Usage: npm run build && node scripts/build-release-branch.mjs <output-dir>

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? path.join(root, 'release'));

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const entry of [...pkg.n8n.nodes, ...pkg.n8n.credentials]) {
	if (!fs.existsSync(path.join(root, entry))) {
		console.error(`Missing ${entry}. Run "npm run build" first.`);
		process.exit(1);
	}
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const packed = JSON.parse(
	execFileSync('npm', ['pack', '--json', '--pack-destination', out], {
		cwd: root,
		encoding: 'utf8',
	}),
);
const tarball = path.join(out, packed[0].filename);
execFileSync('tar', ['-xzf', tarball, '-C', out, '--strip-components=1']);
fs.rmSync(tarball);

const released = JSON.parse(fs.readFileSync(path.join(out, 'package.json'), 'utf8'));
delete released.scripts;
delete released.devDependencies;
fs.writeFileSync(path.join(out, 'package.json'), `${JSON.stringify(released, null, '\t')}\n`);

console.log(`Release branch contents for ${released.name}@${released.version} written to ${out}`);
