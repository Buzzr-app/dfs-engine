import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

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

const [root, release, server] = await Promise.all([
  manifest('package.json'),
  manifest('release-manifest.json'),
  manifest('server.json'),
]);

assert.equal(root.version, expectedVersion, 'root version must equal the reviewed release');
assert.equal(release.releaseVersion, expectedVersion, 'release manifest version must be reviewed');
assert.equal(release.tag, `v${expectedVersion}`, 'release tag must match the reviewed version');
assert.deepEqual(release.registry, {
  npm: 'https://registry.npmjs.org/',
  mcpApi: 'https://registry.modelcontextprotocol.io/v0.1',
  mcpServerName: 'io.github.Buzzr-app/dfs-engine',
  mcpPackage: '@buzzr/mcp',
  repository: 'https://github.com/Buzzr-app/dfs-engine',
  workflowPath: '.github/workflows/release.yml',
  ref: 'refs/heads/main',
});
assert(Array.isArray(release.packages), 'release manifest packages must be an array');
assert.equal(release.packages.length, 10, 'release manifest must cover all ten public packages');

const entriesByName = new Map();
const entriesByPath = new Map();
for (const entry of release.packages) {
  assert.equal(typeof entry.name, 'string');
  assert.match(entry.name, /^@buzzr\/[a-z0-9-]+$/);
  assert.equal(typeof entry.path, 'string');
  assert.match(entry.path, /^packages\/[a-z0-9-]+$/);
  assert.match(entry.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/);
  assert.equal(typeof entry.publish, 'boolean');
  assert.equal(typeof entry.internalDependencies, 'object');
  assert.equal(entriesByName.has(entry.name), false, `duplicate release package ${entry.name}`);
  assert.equal(entriesByPath.has(entry.path), false, `duplicate release path ${entry.path}`);
  entriesByName.set(entry.name, entry);
  entriesByPath.set(entry.path, entry);
}

const expectedPublishes = [
  '@buzzr/dfs-cli',
  '@buzzr/dfs-engine',
  '@buzzr/dfs-engine-test-vectors',
  '@buzzr/dfs-testkit',
  '@buzzr/mcp',
];
assert.deepEqual(
  release.packages
    .filter((entry) => entry.publish)
    .map((entry) => entry.name)
    .sort(),
  expectedPublishes,
  'release manifest must authorize exactly the five reviewed package publishes',
);

const workspaceDirectories = (await readdir('packages', { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => `packages/${entry.name}`)
  .sort();
assert.deepEqual(
  workspaceDirectories,
  [...entriesByPath.keys()].sort(),
  'release manifest must match the complete workspace directory set',
);

const packageManifests = new Map();
for (const entry of release.packages) {
  const packageManifest = await manifest(join(entry.path, 'package.json'));
  packageManifests.set(entry.name, packageManifest);
  assert.equal(packageManifest.name, entry.name, `${entry.path} package name drifted`);
  assert.equal(packageManifest.version, entry.version, `${entry.name} version drifted`);
  assert.notEqual(packageManifest.private, true, `${entry.name} must remain public`);
  assert.equal(
    packageManifest.publishConfig?.access,
    'public',
    `${entry.name} must publish publicly`,
  );

  const internalDependencies = Object.fromEntries(
    Object.entries(packageManifest.dependencies ?? {}).filter(([name]) =>
      name.startsWith('@buzzr/'),
    ),
  );
  assert.deepEqual(
    internalDependencies,
    entry.internalDependencies,
    `${entry.name} internal dependency pins or ranges drifted`,
  );
  for (const section of ['devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const unexpected = Object.keys(packageManifest[section] ?? {}).filter((name) =>
      name.startsWith('@buzzr/'),
    );
    assert.deepEqual(unexpected, [], `${entry.name} has unreviewed internal ${section}`);
  }
}

assert.equal(server.version, expectedVersion, 'server version must equal the reviewed release');
assert.equal(server.name, release.registry.mcpServerName);
assert.deepEqual(server.repository, {
  url: release.registry.repository,
  source: 'github',
  id: '1234984143',
  subfolder: 'packages/mcp',
});
assert.equal(server.packages?.length, 1, 'server must expose exactly one npm package');
assert.deepEqual(server.packages[0], {
  registryType: 'npm',
  identifier: release.registry.mcpPackage,
  version: entriesByName.get(release.registry.mcpPackage)?.version,
  transport: { type: 'stdio' },
});
const mcp = packageManifests.get(release.registry.mcpPackage);
assert(mcp, 'release manifest must include the MCP package');
assert.equal(mcp.mcpName, server.name, 'npm and MCP Registry package names must remain linked');
assert.equal(
  mcp.version,
  server.version,
  'npm and MCP Registry package versions must remain linked',
);

const remainingChangesets = (await readdir('.changeset')).filter(
  (name) => name.endsWith('.md') && name !== 'README.md',
);
assert.deepEqual(remainingChangesets, [], 'versioned release must not retain pending changesets');

console.log(
  `Verified ${release.packages.length} exact package versions, ${expectedPublishes.length} publishes, internal dependency ranges, registry linkage, and zero pending changesets for ${expectedVersion}.`,
);
