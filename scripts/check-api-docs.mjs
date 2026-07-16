import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

const publicPackages = [
  ['bets-core', '@buzzr/bets-core'],
  ['dfs-cli', '@buzzr/dfs-cli'],
  ['dfs-engine', '@buzzr/dfs-engine'],
  ['dfs-engine-test-vectors', '@buzzr/dfs-engine-test-vectors'],
  ['dfs-provider-espn', '@buzzr/dfs-provider-espn'],
  ['dfs-provider-sportradar', '@buzzr/dfs-provider-sportradar'],
  ['dfs-react', '@buzzr/dfs-react'],
  ['dfs-testkit', '@buzzr/dfs-testkit'],
  ['entertainment-engine', '@buzzr/entertainment-engine'],
  ['mcp', '@buzzr/mcp'],
];

async function readJson(path, label) {
  const text = await readFile(resolve(root, path), 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') {
      assert.fail(`${label} is missing: ${path}`);
    }
    throw error;
  });

  try {
    return JSON.parse(text);
  } catch (error) {
    assert.fail(`${label} is not valid JSON: ${error.message}`);
  }
}

const [rootManifest, typedocConfig, docsWorkflow, apiIndex] = await Promise.all([
  readJson('package.json', 'Root package manifest'),
  readJson('typedoc.json', 'Root TypeDoc configuration'),
  readFile(resolve(root, '.github/workflows/docs.yml'), 'utf8'),
  readFile(resolve(root, 'docs/api-reference.md'), 'utf8'),
]);

assert.equal(
  typedocConfig.entryPointStrategy,
  'packages',
  'Root TypeDoc must use package entry-point strategy.',
);

const expectedEntryPoints = publicPackages.map(([directory]) => `packages/${directory}`).sort();
const actualEntryPoints = (typedocConfig.entryPoints ?? [])
  .map((entryPoint) => relative(root, resolve(root, entryPoint)))
  .sort();
assert.deepEqual(
  actualEntryPoints,
  expectedEntryPoints,
  'Root TypeDoc entry points must include every public package root exactly once.',
);

const docsCommand = rootManifest.scripts?.docs ?? '';
assert.match(docsCommand, /(?:^|\s)typedoc(?:\s|$)/, 'The root docs command must invoke TypeDoc.');
assert.doesNotMatch(
  docsCommand,
  /(?:--workspace|packages\/dfs-engine)/,
  'The root docs command must not delegate to the dfs-engine workspace.',
);
assert.match(
  docsCommand,
  /node scripts\/check-api-docs\.mjs/,
  'The root docs command must validate the generated all-package output.',
);

const outputDirectory = relative(root, resolve(root, typedocConfig.out ?? ''));
assert.ok(outputDirectory, 'Root TypeDoc must declare an output directory.');
assert.match(
  docsWorkflow,
  new RegExp(`path:\\s*${outputDirectory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`),
  `The Pages workflow must upload the root TypeDoc output (${outputDirectory}).`,
);

assert.doesNotMatch(
  apiIndex,
  /TypeDoc[^\n]*@buzzr\/dfs-engine[^\n]*only/i,
  'docs/api-reference.md must not claim that TypeDoc covers only dfs-engine.',
);

const apiJsonPath = typedocConfig.json;
assert.equal(
  typeof apiJsonPath,
  'string',
  'Root TypeDoc must emit a machine-readable JSON model for coverage verification.',
);
const apiModel = await readJson(apiJsonPath, 'Generated TypeDoc API model');
const documentedPackages = new Set(
  (apiModel.children ?? [])
    .filter((reflection) => reflection.kindString === 'Module' || reflection.kind === 2)
    .map((reflection) => reflection.name),
);

for (const [directory, packageName] of publicPackages) {
  const manifest = await readJson(`packages/${directory}/package.json`, `${packageName} manifest`);
  assert.equal(manifest.name, packageName, `${directory} must still publish as ${packageName}.`);
  assert.ok(
    documentedPackages.has(packageName),
    `Generated TypeDoc API model must include the ${packageName} package root.`,
  );
  assert.ok(apiIndex.includes(packageName), `docs/api-reference.md must index ${packageName}.`);
}

const htmlPath = resolve(root, outputDirectory, 'index.html');
const html = await readFile(htmlPath, 'utf8').catch((error) => {
  if (error?.code === 'ENOENT') {
    assert.fail(`Generated TypeDoc Pages entry point is missing: ${relative(root, htmlPath)}`);
  }
  throw error;
});
assert.match(html, /Buzzr Sports Engine API/i, 'Generated Pages entry point must identify Buzzr APIs.');

console.log(`All-package TypeDoc contract passed for ${publicPackages.length} package roots.`);
