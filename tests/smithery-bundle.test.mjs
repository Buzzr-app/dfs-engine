import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { zipSync } from 'fflate';

const rootManifest = JSON.parse(await readFile('package.json', 'utf8'));
const rootLock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const ciWorkflow = await readFile('.github/workflows/ci.yml', 'utf8');
const mcpbTooling = await readFile('scripts/lib/mcpb-cli.mjs', 'utf8');
const smitheryPublisher = await readFile('scripts/publish-smithery-bundle.mjs', 'utf8');

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
  assert.match(
    ciWorkflow,
    /os: \[ubuntu-latest, macos-latest, windows-latest\]/,
    'Linux, macOS, and Windows must all build and prove the MCPB',
  );
});

test('uses integrity-locked local MCPB tooling without a credential-bearing subprocess', () => {
  assert.equal(rootManifest.devDependencies.fflate, '0.8.2');
  assert.deepEqual(rootLock.packages['node_modules/fflate'], {
    version: '0.8.2',
    resolved: 'https://registry.npmjs.org/fflate/-/fflate-0.8.2.tgz',
    integrity: 'sha512-cPJU47OaAoCbg0pBvzsgpTPhmhqI5eJjh/JIu8tPj5q+T7iLvW/JAYUqmE7KOB4R1ZyEhzBaIQpQpardBF5z8A==',
    dev: true,
    license: 'MIT',
  });
  assert.doesNotMatch(mcpbTooling, /npm exec|@anthropic-ai\/mcpb/);
  assert.doesNotMatch(mcpbTooling, /\.\.\.process\.env/);
});

test('pins the official MCPB v0.4 schema and preflights hostile archives', async () => {
  const schema = await readFile('smithery/mcpb-manifest-v0.4.schema.json');
  assert.equal(
    createHash('sha256').update(schema).digest('hex'),
    '9e4fa3cdc4ae3872b3d76dd538a2517c4e9cf43a7ea2707819e11aedce09ee69',
  );
  const { inspectMcpbArchive } = await import('../scripts/lib/mcpb-cli.mjs');
  assert.throws(
    () => inspectMcpbArchive(zipSync({ '../escape.txt': new Uint8Array([1]) })),
    /escapes|normalized/i,
  );

  const bomb = Buffer.from(zipSync({ 'safe.txt': new Uint8Array([1]) }));
  const centralOffset = bomb.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert(centralOffset >= 0);
  bomb.writeUInt32LE(100 * 1024 * 1024 + 1, centralOffset + 24);
  assert.throws(() => inspectMcpbArchive(bomb), /declared content is too large/i);

  const symlink = Buffer.from(zipSync({ 'link.txt': new Uint8Array([1]) }));
  const symlinkCentralOffset = symlink.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  symlink.writeUInt32LE((0o120777 << 16) >>> 0, symlinkCentralOffset + 38);
  assert.throws(() => inspectMcpbArchive(symlink), /symbolic link/i);
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
    serverInfo: { name: 'buzzr', version: '5.1.0' },
    tools,
  });

  assert.deepEqual(payload, {
    type: 'stdio',
    runtime: 'node',
    serverCard: {
      serverInfo: { name: 'buzzr', version: '5.1.0' },
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
        serverInfo: { name: 'buzzr', version: '5.1.0' },
        tools: [{ name: 'fair_line', description: 'Missing its input schema.' }],
      }),
    /inputSchema/i,
  );
});

test('the publisher downloads and re-proves the accepted registry bundle', () => {
  assert.match(smitheryPublisher, /\/servers\/\$\{qualifiedName\}\/download/);
  assert.match(smitheryPublisher, /SMITHERY_EXPECTED_SHA256/);
  assert.match(smitheryPublisher, /prove-smithery-bundle\.mjs/);
});
