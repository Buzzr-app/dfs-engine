import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { runMcpb } from './lib/mcpb-cli.mjs';
import { createSmitheryReleasePayload } from './lib/smithery-release.mjs';
import { smitheryBundleFilename } from './lib/smithery-bundle.mjs';

const terminalStatuses = new Set([
  'AUTH_REQUIRED',
  'AUTH_TIMEOUT',
  'CANCELLED',
  'FAILURE',
  'FAILURE_SCAN',
  'INTERNAL_ERROR',
  'SUCCESS',
]);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(await readFile(join(root, 'smithery', 'source.json'), 'utf8'));
const artifactPath = join(root, 'artifacts', 'smithery', smitheryBundleFilename(source.version));
const metadata = JSON.parse(await readFile(`${artifactPath}.json`, 'utf8'));
const artifact = await readFile(artifactPath);
const apiKey = process.env.SMITHERY_API_KEY;

assert(
  typeof apiKey === 'string' && apiKey.length >= 20 && !/\s/.test(apiKey),
  'SMITHERY_API_KEY is required',
);
assert.equal(createHash('sha256').update(artifact).digest('hex'), metadata.sha256);
assert.equal(metadata.qualifiedName, source.qualifiedName);
assert.equal(metadata.toolCount, 11);

async function smitheryRequest(path, options = {}) {
  const response = await fetch(`https://api.smithery.ai${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
    signal: AbortSignal.timeout(options.timeout ?? 30_000),
  });
  const text = await response.text();
  let body;
  try {
    body = text.length === 0 ? {} : JSON.parse(text);
  } catch {
    body = { error: text.slice(0, 2_000) };
  }
  if (!response.ok) {
    throw new Error(
      `Smithery ${options.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }
  return body;
}

function childEnvironment(temporaryRoot) {
  const inherited = Object.fromEntries(
    ['PATH', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT'].flatMap((key) =>
      process.env[key] ? [[key, process.env[key]]] : [],
    ),
  );
  const home = join(temporaryRoot, 'home');
  const temporaryDirectory = join(temporaryRoot, 'tmp');
  return {
    ...inherited,
    HOME: home,
    USERPROFILE: home,
    TMPDIR: temporaryDirectory,
    TEMP: temporaryDirectory,
    TMP: temporaryDirectory,
    NO_COLOR: '1',
  };
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'buzzr-smithery-publish-'));
try {
  const unpackedDirectory = join(temporaryRoot, 'unpacked');
  await mkdir(join(temporaryRoot, 'home'), { recursive: true });
  await mkdir(join(temporaryRoot, 'tmp'), { recursive: true });
  await runMcpb(['unpack', artifactPath, unpackedDirectory], {
    cwd: root,
    env: { NPM_CONFIG_CACHE: join(temporaryRoot, 'mcpb-cache') },
  });

  const manifest = JSON.parse(await readFile(join(unpackedDirectory, 'manifest.json'), 'utf8'));
  const entryPoint = resolve(unpackedDirectory, manifest.server.entry_point);
  assert(entryPoint.startsWith(`${resolve(unpackedDirectory)}${sep}`));

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entryPoint],
    cwd: unpackedDirectory,
    env: childEnvironment(temporaryRoot),
    stderr: 'pipe',
  });
  const client = new Client({ name: 'buzzr-smithery-publisher', version: '1.0.0' });
  let listed;
  try {
    await client.connect(transport);
    listed = await client.listTools();
  } finally {
    await client.close();
  }
  assert.equal(listed.tools.length, 11);
  const payload = createSmitheryReleasePayload({ manifest, tools: listed.tools });

  const qualifiedName = encodeURIComponent(source.qualifiedName);
  await smitheryRequest(`/servers/${qualifiedName}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: manifest.display_name,
      description: manifest.description,
    }),
  });

  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  form.append('bundle', new Blob([artifact], { type: 'application/octet-stream' }), 'server.mcpb');
  const accepted = await smitheryRequest(`/servers/${qualifiedName}/releases`, {
    method: 'PUT',
    body: form,
    timeout: 120_000,
  });
  const deploymentId = accepted.deploymentId ?? accepted.id;
  assert.match(deploymentId, /^[0-9a-f-]{36}$/i);
  process.stdout.write(
    `${JSON.stringify({ stage: 'accepted', deploymentId, qualifiedName: source.qualifiedName })}\n`,
  );

  let release = accepted;
  const deadline = Date.now() + 10 * 60_000;
  while (!terminalStatuses.has(release.status)) {
    assert(Date.now() < deadline, 'Smithery deployment timed out');
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
    release = await smitheryRequest(`/servers/${qualifiedName}/releases/${deploymentId}`);
  }
  assert.equal(
    release.status,
    'SUCCESS',
    `Smithery deployment failed: ${JSON.stringify(release.logs ?? [])}`,
  );
  process.stdout.write(
    `${JSON.stringify({
      stage: 'published',
      deploymentId,
      status: release.status,
      qualifiedName: source.qualifiedName,
      page: `https://smithery.ai/servers/${source.qualifiedName}`,
      mcpUrl: release.mcpUrl ?? accepted.mcpUrl,
      sha256: metadata.sha256,
      toolCount: listed.tools.length,
    })}\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
