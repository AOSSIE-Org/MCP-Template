import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('version synchronization', () => {
    it('package.json, mcp.config.json, and VERSION must have matching version strings', async () => {
        const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
        const config = JSON.parse(await readFile(resolve(root, 'mcp.config.json'), 'utf8'));
        const versionFile = (await readFile(resolve(root, 'VERSION'), 'utf8')).trim();

        assert.equal(
            config.server.version,
            pkg.version,
            'mcp.config.json server.version must match package.json version'
        );
        assert.equal(
            versionFile,
            pkg.version,
            'VERSION file content must match package.json version'
        );
    });

    it('scripts/sync-version.mjs runs cleanly when already in sync', () => {
        const output = execFileSync(
            process.execPath,
            [resolve(root, 'scripts/sync-version.mjs')],
            { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        );
        assert.ok(true);
    });
});
