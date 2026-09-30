#!/usr/bin/env node
/**
 * Copies `package.json`'s version into `mcp.config.json` and `VERSION`.
 *
 * Wired to npm's `version` lifecycle script, which runs after the bump and
 * before the release commit — so `npm version minor` updates all files and
 * commits them together.
 *
 * Without this, the version reported in the MCP handshake drifts from the
 * published package, and the mismatch is invisible until someone tries to
 * reproduce a bug against "the version the server said it was".
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const pkgPath = resolve(root, 'package.json');
const configPath = resolve(root, 'mcp.config.json');
const versionFilePath = resolve(root, 'VERSION');

const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
const raw = await readFile(configPath, 'utf8');
const config = JSON.parse(raw);

let versionFile = '';
try {
    versionFile = (await readFile(versionFilePath, 'utf8')).trim();
} catch {
    // If VERSION does not exist yet, it will be created below.
}

if (config.server.version === pkg.version && versionFile === pkg.version) {
    console.error(`[sync-version] already ${pkg.version}`);
    process.exit(0);
}

const previous = config.server.version;
config.server.version = pkg.version;
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
await writeFile(versionFilePath, `${pkg.version}\n`, 'utf8');
console.error(`[sync-version] mcp.config.json & VERSION ${previous} -> ${pkg.version}`);

// Stage it so `npm version` includes it in the release commit. Harmless outside
// a repo or when run by hand — a failure here is not worth aborting the bump.
try {
    execFileSync('git', ['add', 'mcp.config.json', 'VERSION'], { cwd: root, stdio: 'ignore' });
} catch {
    console.error('[sync-version] could not stage mcp.config.json and VERSION; commit them yourself');
}
