import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const officialServersEndpoint = 'https://registry.modelcontextprotocol.io/v0.1/servers';
const [release, expectedServer] = await Promise.all([
  readFile('release-manifest.json', 'utf8').then(JSON.parse),
  readFile('server.json', 'utf8').then(JSON.parse),
]);
assert.equal(`${release.registry.mcpApi}/servers`, officialServersEndpoint);
assert.equal(expectedServer.name, release.registry.mcpServerName);
assert.equal(expectedServer.version, release.releaseVersion);

const recordUrl = `${officialServersEndpoint}/${encodeURIComponent(expectedServer.name)}/versions/${encodeURIComponent(expectedServer.version)}`;
const response = await fetch(recordUrl, {
  headers: { accept: 'application/json', 'user-agent': 'buzzr-mcp-registry-proof/5.1' },
  redirect: 'error',
  signal: AbortSignal.timeout(15_000),
});

if (response.status === 404 && process.env.MCP_REGISTRY_ALLOW_MISSING === '1') {
  process.stderr.write(`${expectedServer.name}@${expectedServer.version} is not published yet.\n`);
  process.exitCode = 3;
} else {
  assert.equal(response.ok, true, `${recordUrl} returned HTTP ${response.status}`);
  const record = await response.json();
  assert.equal(record.server?.name, expectedServer.name);
  assert.equal(record.server?.version, expectedServer.version);
  assert.equal(record.server?.title, expectedServer.title);
  assert.equal(record.server?.description, expectedServer.description);
  assert.equal(record.server?.websiteUrl, expectedServer.websiteUrl);
  assert.equal(record.server?.$schema, expectedServer.$schema);
  assert.deepEqual(record.server?.repository, expectedServer.repository);
  assert.equal(record.server?.packages?.length, 1);
  const publishedPackage = record.server.packages[0];
  const expectedPackage = expectedServer.packages[0];
  assert.equal(publishedPackage.registryType, expectedPackage.registryType);
  assert.equal(publishedPackage.identifier, expectedPackage.identifier);
  assert.equal(publishedPackage.version, expectedPackage.version);
  assert.deepEqual(publishedPackage.transport, expectedPackage.transport);
  const official = record._meta?.['io.modelcontextprotocol.registry/official'];
  assert.equal(official?.status, 'active');
  assert.equal(typeof official?.isLatest, 'boolean');
  assert.equal(Number.isNaN(Date.parse(official?.publishedAt)), false);

  process.stdout.write(
    `Proved exact official MCP Registry record ${expectedServer.name}@${expectedServer.version}.\n`,
  );
}
