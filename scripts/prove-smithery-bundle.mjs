import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { runMcpb } from './lib/mcpb-cli.mjs';
import { SMITHERY_QUALIFIED_NAME, smitheryBundleFilename } from './lib/smithery-bundle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(await readFile(join(root, 'smithery', 'source.json'), 'utf8'));
const defaultArtifact = join(root, 'artifacts', 'smithery', smitheryBundleFilename(source.version));
const artifactPath = resolve(process.env.SMITHERY_MCPB_PATH ?? defaultArtifact);
const maximumBundleBytes = 25 * 1024 * 1024;
const maximumExtractedBytes = 100 * 1024 * 1024;
const maximumCapturedBytes = 256 * 1024;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function withDeadline(promise, label, timeoutMs = 30_000) {
  let timeout;
  return Promise.race([
    promise.finally(() => clearTimeout(timeout)),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

function parseToolResult(result) {
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, 'text');
  return JSON.parse(result.content[0].text);
}

async function inspectExtractedTree(directory) {
  let totalBytes = 0;
  const topLevel = (await readdir(directory)).sort();
  assert.deepEqual(topLevel, ['LICENSE', 'README.md', 'manifest.json', 'server', 'source.json']);

  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      const pathStat = await lstat(path);
      assert.equal(
        pathStat.isSymbolicLink(),
        false,
        `MCPB contains symlink: ${relative(directory, path)}`,
      );
      assert.doesNotMatch(
        entry.name,
        /^(?:\.env(?:\..*)?|\.npmrc)$/i,
        'MCPB contains a secret file',
      );
      if (pathStat.isDirectory()) {
        await visit(path);
      } else {
        assert.equal(pathStat.isFile(), true, `MCPB contains a non-file entry: ${path}`);
        totalBytes += pathStat.size;
        assert(totalBytes <= maximumExtractedBytes, 'MCPB extracted content is too large');
      }
    }
  }

  await visit(directory);
}

const artifact = await readFile(artifactPath);
const artifactStat = await stat(artifactPath);
assert.equal(artifactStat.isFile(), true);
assert(artifactStat.size <= maximumBundleBytes, 'Smithery bundle is too large');

const localMetadataPath = `${defaultArtifact}.json`;
const expectedSha256 = process.env.SMITHERY_EXPECTED_SHA256
  ? process.env.SMITHERY_EXPECTED_SHA256
  : JSON.parse(await readFile(localMetadataPath, 'utf8')).sha256;
assert.match(expectedSha256, /^[0-9a-f]{64}$/);
assert.equal(sha256(artifact), expectedSha256, 'Smithery bundle SHA-256 changed');

const temporaryRoot = await mkdtemp(join(tmpdir(), 'buzzr-smithery-proof-'));
const unpackedDirectory = join(temporaryRoot, 'unpacked');

try {
  await runMcpb(['unpack', artifactPath, unpackedDirectory], {
    cwd: root,
    env: { NPM_CONFIG_CACHE: join(temporaryRoot, 'mcpb-cache') },
  });
  await inspectExtractedTree(unpackedDirectory);

  const [manifest, bundleSource] = await Promise.all(
    ['manifest.json', 'source.json'].map(async (filename) =>
      JSON.parse(await readFile(join(unpackedDirectory, filename), 'utf8')),
    ),
  );
  assert.equal(bundleSource.qualifiedName, SMITHERY_QUALIFIED_NAME);
  assert.equal(bundleSource.version, source.version);
  assert.equal(bundleSource.integrity, source.integrity);
  assert.equal(manifest.version, source.version);
  assert.equal(manifest.tools.length, 11);
  assert.equal(manifest.server.type, 'node');
  assert.equal(manifest.server.entry_point, 'server/index.js');
  assert.doesNotMatch(JSON.stringify(manifest), /api.?key|password|secret|token/i);

  const entryPoint = resolve(unpackedDirectory, manifest.server.entry_point);
  assert(
    entryPoint.startsWith(`${resolve(unpackedDirectory)}${sep}`),
    'MCPB entry point escapes the bundle',
  );
  const isolatedHome = join(temporaryRoot, 'home');
  const childEnvironment = Object.fromEntries(
    ['PATH', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT'].flatMap((key) =>
      process.env[key] ? [[key, process.env[key]]] : [],
    ),
  );
  Object.assign(childEnvironment, {
    HOME: isolatedHome,
    USERPROFILE: isolatedHome,
    TMPDIR: join(temporaryRoot, 'tmp'),
    TEMP: join(temporaryRoot, 'tmp'),
    TMP: join(temporaryRoot, 'tmp'),
    NO_COLOR: '1',
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entryPoint],
    cwd: unpackedDirectory,
    env: childEnvironment,
    stderr: 'pipe',
  });
  let stderr = '';
  let stderrOverflow = false;
  transport.stderr?.on('data', (chunk) => {
    if (stderrOverflow) return;
    const next = stderr + chunk.toString();
    if (Buffer.byteLength(next) > maximumCapturedBytes) {
      stderrOverflow = true;
      return;
    }
    stderr = next;
  });

  const client = new Client({ name: 'buzzr-smithery-proof', version: '1.0.0' });
  try {
    await withDeadline(client.connect(transport), 'Smithery MCPB initialization');
    assert.deepEqual(client.getServerVersion(), { name: 'buzzr', version: source.version });

    const listed = await withDeadline(client.listTools(), 'Smithery MCPB tools/list');
    assert.deepEqual(
      listed.tools.map(({ name }) => name),
      manifest.tools.map(({ name }) => name),
    );

    const fairLine = parseToolResult(
      await withDeadline(
        client.callTool({
          name: 'fair_line',
          arguments: { selected: -110, opposite: -110, selectedSide: 'proof' },
        }),
        'Smithery MCPB fair_line call',
      ),
    );
    assert.equal(fairLine.selectedSide, 'proof');
    assert.equal(fairLine.fairProbability, 0.5);
    assert.equal(fairLine.overround > 0, true);
  } finally {
    await withDeadline(client.close(), 'Smithery MCPB shutdown');
  }

  assert.equal(stderrOverflow, false);
  assert.match(stderr, /buzzr MCP server v\S+ listening on stdio/);
  process.stdout.write(
    `Smithery MCPB ${source.version} passed exact hash, safe extraction, ${manifest.tools.length} tools, and real-client proof for ${bundleSource.qualifiedName}.\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
