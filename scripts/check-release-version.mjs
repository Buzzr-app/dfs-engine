import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const expectedVersion = process.env.EXPECTED_RELEASE_VERSION?.trim();
assert(expectedVersion, 'EXPECTED_RELEASE_VERSION is required');
assert.match(
  expectedVersion,
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/,
  'EXPECTED_RELEASE_VERSION must be an exact semantic version',
);

async function manifest(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

const [root, engine, vectors, mcp, bets, entertainment, server] = await Promise.all([
  manifest('package.json'),
  manifest('packages/dfs-engine/package.json'),
  manifest('packages/dfs-engine-test-vectors/package.json'),
  manifest('packages/mcp/package.json'),
  manifest('packages/bets-core/package.json'),
  manifest('packages/entertainment-engine/package.json'),
  manifest('server.json'),
]);

for (const [name, version] of [
  ['root', root.version],
  [engine.name, engine.version],
  [vectors.name, vectors.version],
  [mcp.name, mcp.version],
  ['server', server.version],
  ['server npm package', server.packages?.[0]?.version],
]) {
  assert.equal(version, expectedVersion, `${name} version must equal the reviewed release`);
}

assert.equal(mcp.dependencies['@buzzr/dfs-engine'], engine.version);
assert.equal(mcp.dependencies['@buzzr/bets-core'], bets.version);
assert.equal(mcp.dependencies['@buzzr/entertainment-engine'], entertainment.version);
assert.equal(vectors.dependencies['@buzzr/dfs-engine'], engine.version);
assert.equal(mcp.mcpName, server.name);

console.log(`Verified synchronized Buzzr release metadata for ${expectedVersion}.`);
