import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [rootManifest, mcpManifest, server] = await Promise.all(
  ['package.json', 'packages/mcp/package.json', 'server.json'].map(async (path) =>
    JSON.parse(await readFile(path, 'utf8')),
  ),
);

const schema = 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json';
const registryName = 'io.github.Buzzr-app/dfs-engine';
const repositoryUrl = 'https://github.com/Buzzr-app/dfs-engine';

assert.equal(server.$schema, schema);
assert.equal(mcpManifest.mcpName, registryName);
assert.equal(server.name, registryName);
assert.equal(server.title, 'Buzzr Sports Engine');
assert.equal(typeof server.description, 'string');
assert(server.description.length > 0 && server.description.length <= 100);
assert.equal(server.version, mcpManifest.version);
assert.equal(server.version, rootManifest.version);
assert.deepEqual(server.repository, {
  url: repositoryUrl,
  source: 'github',
  id: '1234984143',
  subfolder: 'packages/mcp',
});
assert.equal(server.websiteUrl, 'https://buzzr-app.github.io/dfs-engine/');
assert.equal(server.packages.length, 1);
assert.deepEqual(server.packages[0], {
  registryType: 'npm',
  identifier: '@buzzr/mcp',
  version: mcpManifest.version,
  transport: { type: 'stdio' },
});
assert(!JSON.stringify(server).match(/environmentVariables|secret|token|api.?key/i));

console.log(`Verified MCP Registry metadata for ${registryName}@${server.version}.`);
