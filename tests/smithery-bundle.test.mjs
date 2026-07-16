import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootManifest = JSON.parse(await readFile('package.json', 'utf8'));
const ciWorkflow = await readFile('.github/workflows/ci.yml', 'utf8');

const sampleTools = [
  { name: 'fair_line', description: 'Calculate a no-vig fair line.' },
  { name: 'grade_dfs_entry', description: 'Grade one DFS entry.' },
];

test('creates a branded Smithery manifest without secrets or mutable caller data', async () => {
  const { createSmitheryManifest } = await import('../scripts/lib/smithery-bundle.mjs');
  const manifest = createSmitheryManifest({ version: '5.1.0', tools: sampleTools });

  assert.equal(
    manifest.$schema,
    'https://raw.githubusercontent.com/modelcontextprotocol/mcpb/main/schemas/mcpb-manifest-v0.4.schema.json',
  );
  assert.equal(manifest.manifest_version, '0.4');
  assert.equal(manifest.name, 'buzzr-sports-engine');
  assert.equal(manifest.display_name, 'Buzzr Sports Engine');
  assert.equal(manifest.version, '5.1.0');
  assert.deepEqual(manifest.author, {
    name: 'Sarvesh Chidambaram',
    url: 'https://github.com/Buzzr-app',
  });
  assert.deepEqual(manifest.repository, {
    type: 'git',
    url: 'https://github.com/Buzzr-app/dfs-engine',
  });
  assert.deepEqual(manifest.server, {
    type: 'node',
    entry_point: 'server/index.js',
    mcp_config: {
      command: 'node',
      args: ['${__dirname}/server/index.js'],
      env: {},
    },
  });
  assert.deepEqual(manifest.compatibility, {
    platforms: ['darwin', 'win32', 'linux'],
    runtimes: { node: '>=22' },
  });
  assert.deepEqual(manifest.tools, sampleTools);
  assert.equal(manifest.tools_generated, false);
  assert.equal(manifest.user_config, undefined);
  assert.doesNotMatch(JSON.stringify(manifest), /api.?key|password|secret|token/i);

  sampleTools[0].description = 'Caller mutation';
  assert.equal(manifest.tools[0].description, 'Calculate a no-vig fair line.');
});

test('rejects unsafe Smithery manifest inputs', async () => {
  const { createSmitheryManifest } = await import('../scripts/lib/smithery-bundle.mjs');

  assert.throws(
    () => createSmitheryManifest({ version: '../5.1.0', tools: sampleTools }),
    /semantic version/i,
  );
  assert.throws(
    () =>
      createSmitheryManifest({
        version: '5.1.0',
        tools: [
          { name: 'fair_line', description: 'One.' },
          { name: 'fair_line', description: 'Two.' },
        ],
      }),
    /unique/i,
  );
  assert.throws(
    () =>
      createSmitheryManifest({
        version: '5.1.0',
        tools: [{ name: '../escape', description: 'Unsafe.' }],
      }),
    /tool name/i,
  );
});

test('derives a path-safe immutable MCPB filename from the exact version', async () => {
  const { smitheryBundleFilename } = await import('../scripts/lib/smithery-bundle.mjs');

  assert.equal(smitheryBundleFilename('5.1.0'), 'buzzr-sports-engine-5.1.0.mcpb');
  assert.throws(() => smitheryBundleFilename('../../escape'), /semantic version/i);
});

test('the release gate builds and proves the MCPB on every supported platform', () => {
  assert.equal(rootManifest.scripts['build:mcpb'], 'node scripts/build-smithery-bundle.mjs');
  assert.equal(rootManifest.scripts['proof:mcpb'], 'node scripts/prove-smithery-bundle.mjs');
  assert.match(rootManifest.scripts.verify, /npm run build:mcpb && npm run proof:mcpb/);
  assert.match(
    ciWorkflow,
    /mcp-packed-platforms:[\s\S]*run: npm run build:mcpb[\s\S]*run: npm run proof:mcpb/,
  );
});

test('builds the full Smithery stdio server card required by the release API', async () => {
  const { createSmitheryReleasePayload } = await import('../scripts/lib/smithery-release.mjs');
  const tools = [
    {
      name: 'fair_line',
      description: 'Calculate a no-vig fair line.',
      inputSchema: {
        type: 'object',
        properties: { selected: { type: 'number' } },
        required: ['selected'],
      },
    },
  ];
  const payload = createSmitheryReleasePayload({
    manifest: { name: 'buzzr-sports-engine', version: '5.1.0' },
    tools,
  });

  assert.deepEqual(payload, {
    type: 'stdio',
    runtime: 'node',
    serverCard: {
      serverInfo: { name: 'buzzr-sports-engine', version: '5.1.0' },
      tools,
    },
  });

  tools[0].inputSchema.properties.selected.type = 'string';
  assert.equal(payload.serverCard.tools[0].inputSchema.properties.selected.type, 'number');
});

test('rejects the incomplete MCPB tool summaries that Smithery release validation rejects', async () => {
  const { createSmitheryReleasePayload } = await import('../scripts/lib/smithery-release.mjs');

  assert.throws(
    () =>
      createSmitheryReleasePayload({
        manifest: { name: 'buzzr-sports-engine', version: '5.1.0' },
        tools: [{ name: 'fair_line', description: 'Missing its input schema.' }],
      }),
    /inputSchema/i,
  );
});
