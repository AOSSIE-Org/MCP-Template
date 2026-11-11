#!/usr/bin/env node
/**
 * Keeps the package, MCP config, and release VERSION file on one version.
 *
 * npm runs this hook after it has updated package.json during `npm version`.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = resolve(root, 'package.json');
const configPath = resolve(root, 'mcp.config.json');
const versionPath = resolve(root, 'VERSION');
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
const version = packageJson.version;
if (!semver.test(version)) {
    throw new Error(`[version] package.json contains an invalid version: ${version}`);
}

const configContents = await readFile(configPath, 'utf8');
const config = JSON.parse(configContents);
if (!config.server || typeof config.server !== 'object') {
    throw new Error('[version] mcp.config.json is missing the server object');
}
const configVersionPattern = /("server"\s*:\s*\{[\s\S]*?"version"\s*:\s*)"[^"]+"/;
if (!configVersionPattern.test(configContents)) {
    throw new Error('[version] could not locate server.version in mcp.config.json');
}
const updatedConfigContents = configContents.replace(
    configVersionPattern,
    `$1${JSON.stringify(version)}`
);

const files = [
    [configPath, updatedConfigContents],
    [versionPath, `${version}\n`]
];

if (process.argv.includes('--check')) {
    const versionFile = (await readFile(versionPath, 'utf8')).trim();
    if (config.server.version !== version || versionFile !== version) {
        throw new Error(
            `[version] out of sync: package.json=${version}, ` +
                `mcp.config.json=${config.server.version}, VERSION=${versionFile}`
        );
    }
    console.error(`[version] all files contain ${version}`);
    process.exit(0);
}

for (const [path, contents] of files) {
    const temporaryPath = `${path}.${process.pid}.tmp`;
    await writeFile(temporaryPath, contents, 'utf8');
    await rename(temporaryPath, path);
}

console.error(`[version] synchronized package.json, mcp.config.json, and VERSION to ${version}`);
