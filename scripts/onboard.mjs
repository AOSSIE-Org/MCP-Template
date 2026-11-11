#!/usr/bin/env node
/**
 * Rewrites the template's project-specific identity in one pass.
 *
 * Interactive use: `npm run onboard`
 * Automation: `npm run onboard -- --project=solar-oracle --repo=AOSSIE-Org/SolarOracle
 *   --noun=forecast --nouns=forecasts --clean --yes`
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map(
    process.argv.slice(2)
        .filter(arg => arg.startsWith('--'))
        .map(arg => {
            const [key, ...value] = arg.slice(2).split('=');
            return [key, value.join('=') || true];
        })
);

if (args.has('help')) {
    console.log(
        'Usage: node scripts/onboard.mjs [--project=slug] [--repo=owner/repo] ' +
            '[--noun=item] [--nouns=items] [--clean] [--yes]'
    );
    process.exit(0);
}

const questions = async () => {
    const prompt = readline.createInterface({ input, output });
    try {
        return {
            project: await prompt.question('Project slug: '),
            repo: await prompt.question('GitHub repository (owner/name): '),
            noun: await prompt.question('Singular item noun: '),
            nouns: await prompt.question('Plural item noun: ')
        };
    } finally {
        prompt.close();
    }
};

const supplied = {
    project: args.get('project'),
    repo: args.get('repo'),
    noun: args.get('noun'),
    nouns: args.get('nouns')
};
const values = Object.values(supplied).every(value => typeof value === 'string' && value)
    ? supplied
    : await questions();

const project = String(values.project).trim().toLowerCase();
const repo = String(values.repo).trim();
const noun = String(values.noun).trim().toLowerCase();
const nouns = String(values.nouns).trim().toLowerCase();

if (!/^[a-z0-9][a-z0-9-]*$/.test(project)) {
    throw new Error('project must be a lowercase slug containing letters, numbers, and hyphens');
}
if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) throw new Error('repo must look like owner/name');
if (!/^[a-z][a-z0-9_-]*$/.test(noun) || !/^[a-z][a-z0-9_-]*$/.test(nouns)) {
    throw new Error('noun and nouns must contain lowercase letters, numbers, underscores, or hyphens');
}
if (!args.has('yes')) {
    const prompt = readline.createInterface({ input, output });
    const answer = await prompt.question(
        `Onboard ${repo} as ${noun}/${nouns}? This rewrites project identity. [y/N] `
    );
    prompt.close();
    if (!/^y(es)?$/i.test(answer.trim())) {
        console.error('[onboard] cancelled');
        process.exit(0);
    }
}

const packagePath = resolve(root, 'package.json');
const configPath = resolve(root, 'mcp.config.json');
const metaPath = resolve(root, 'catalog/catalog.meta.json');
const readmePath = resolve(root, 'README.md');
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
const config = JSON.parse(await readFile(configPath, 'utf8'));
const meta = JSON.parse(await readFile(metaPath, 'utf8'));

packageJson.name = `@aossie/${project}-mcp`;
packageJson.description = `MCP server for ${repo}`;
packageJson.repository = { type: 'git', url: `git+https://github.com/${repo}.git` };
packageJson.bugs = { url: `https://github.com/${repo}/issues` };
packageJson.homepage = `https://github.com/${repo}#readme`;
packageJson.bin = { [`aossie-${project}-mcp`]: 'dist/index.js' };

config.server.name = `aossie-${project}`;
config.server.title = `${project} MCP`;
config.server.instructions =
    `Read-only access to the ${repo} catalog. Use search_${nouns} to discover entries, ` +
    `then get_${noun} to read one in full.`;
config.catalog.url = `https://${repo.split('/')[0].toLowerCase()}.github.io/${repo.split('/')[1]}/catalog.json`;
config.naming.itemNoun = noun;
config.naming.itemNounPlural = nouns;

meta.project = {
    ...meta.project,
    name: `${project} MCP`,
    description: `Catalog for ${repo}.`,
    repository: `https://github.com/${repo}`
};

let readme = await readFile(readmePath, 'utf8');
readme = readme.replace(/<h1>AOSSIE MCP Template<\/h1>/, `<h1>${project} MCP</h1>`);
readme = readme.replace(/AOSSIE MCP Template/g, `${project} MCP`);
readme = readme.replace(/@aossie\/<project>-mcp/g, `@aossie/${project}-mcp`);
readme = readme.replace(/aossie-<project>/g, `aossie-${project}`);
readme = readme.replace(/<org>\.github\.io\/<repo>/g, `${repo.split('/')[0].toLowerCase()}.github.io/${repo.split('/')[1]}`);

await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
await writeFile(readmePath, readme);

if (args.has('clean')) {
    const sources = resolve(root, 'catalog/sources');
    for (const entry of await readdir(sources)) await rm(resolve(sources, entry), { recursive: true, force: true });
    await mkdir(sources, { recursive: true });
}

console.error(`[onboard] configured ${repo} as ${project} (${noun}/${nouns})`);
