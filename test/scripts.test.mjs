import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('version synchronization script exists and files are synchronized', async () => {
    const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
    const config = JSON.parse(await readFile(resolve(root, 'mcp.config.json'), 'utf8'));
    const version = (await readFile(resolve(root, 'VERSION'), 'utf8')).trim();

    assert.equal(config.server.version, packageJson.version);
    assert.equal(version, packageJson.version);
    await run(process.execPath, ['scripts/sync-version.mjs', '--check'], { cwd: root });
});

test('onboarding script exposes documented automation flags', async () => {
    const { stdout } = await run(process.execPath, ['scripts/onboard.mjs', '--help'], { cwd: root });
    assert.match(stdout, /--project=.*--repo=.*--noun=.*--nouns=.*--clean.*--yes/);
});
