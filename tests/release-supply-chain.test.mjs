import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkerPath = join(repositoryRoot, 'scripts', 'check-release-version.mjs');
const temporaryRoots = [];

const packageDefinitions = [
  { name: '@buzzr/bets-core', path: 'packages/bets-core', version: '5.0.0' },
  {
    name: '@buzzr/dfs-cli',
    path: 'packages/dfs-cli',
    version: '5.0.1',
    publish: true,
    dependencies: { '@buzzr/dfs-engine': '^5.1.0' },
  },
  {
    name: '@buzzr/dfs-engine',
    path: 'packages/dfs-engine',
    version: '5.1.0',
    publish: true,
  },
  {
    name: '@buzzr/dfs-engine-test-vectors',
    path: 'packages/dfs-engine-test-vectors',
    version: '5.1.0',
    publish: true,
    dependencies: { '@buzzr/dfs-engine': '5.1.0' },
  },
  {
    name: '@buzzr/dfs-provider-espn',
    path: 'packages/dfs-provider-espn',
    version: '5.0.0',
    dependencies: { '@buzzr/dfs-engine': '^5.0.0' },
  },
  {
    name: '@buzzr/dfs-provider-sportradar',
    path: 'packages/dfs-provider-sportradar',
    version: '5.0.0',
    dependencies: { '@buzzr/dfs-engine': '^5.0.0' },
  },
  {
    name: '@buzzr/dfs-react',
    path: 'packages/dfs-react',
    version: '5.0.0',
    dependencies: { '@buzzr/dfs-engine': '^5.0.0' },
  },
  {
    name: '@buzzr/dfs-testkit',
    path: 'packages/dfs-testkit',
    version: '5.0.1',
    publish: true,
    dependencies: { '@buzzr/dfs-engine': '^5.1.0' },
  },
  {
    name: '@buzzr/entertainment-engine',
    path: 'packages/entertainment-engine',
    version: '5.0.0',
  },
  {
    name: '@buzzr/mcp',
    path: 'packages/mcp',
    version: '5.1.0',
    publish: true,
    dependencies: {
      '@buzzr/bets-core': '5.0.0',
      '@buzzr/dfs-engine': '5.1.0',
      '@buzzr/entertainment-engine': '5.0.0',
    },
    mcpName: 'io.github.Buzzr-app/dfs-engine',
  },
];

function releaseManifest(definitions = packageDefinitions) {
  return {
    releaseVersion: '5.1.0',
    tag: 'v5.1.0',
    registry: {
      npm: 'https://registry.npmjs.org/',
      mcpServerName: 'io.github.Buzzr-app/dfs-engine',
      mcpPackage: '@buzzr/mcp',
      repository: 'https://github.com/Buzzr-app/dfs-engine',
      workflowPath: '.github/workflows/release.yml',
      ref: 'refs/heads/main',
    },
    packages: definitions.map(({ name, path, version, publish = false, dependencies = {} }) => ({
      name,
      path,
      version,
      publish,
      internalDependencies: dependencies,
    })),
  };
}

async function writeJson(root, path, value) {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(value, null, 2)}\n`);
}

async function createFixture({ definitions = packageDefinitions, manifest, changeset } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'buzzr-release-check-'));
  temporaryRoots.push(root);
  await writeJson(root, 'package.json', {
    name: 'buzzr-dfs-settlement-os',
    version: '5.1.0',
    private: true,
    workspaces: ['packages/*'],
  });
  for (const definition of definitions) {
    await writeJson(root, `${definition.path}/package.json`, {
      name: definition.name,
      version: definition.version,
      private: false,
      publishConfig: { access: 'public' },
      dependencies: definition.dependencies ?? {},
      ...(definition.mcpName ? { mcpName: definition.mcpName } : {}),
    });
  }
  await writeJson(root, 'server.json', {
    name: 'io.github.Buzzr-app/dfs-engine',
    version: '5.1.0',
    repository: {
      url: 'https://github.com/Buzzr-app/dfs-engine',
      source: 'github',
      id: '1234984143',
      subfolder: 'packages/mcp',
    },
    packages: [
      {
        registryType: 'npm',
        identifier: '@buzzr/mcp',
        version: '5.1.0',
        transport: { type: 'stdio' },
      },
    ],
  });
  await writeJson(root, 'release-manifest.json', manifest ?? releaseManifest(definitions));
  await writeJson(root, '.changeset/config.json', {});
  if (changeset) {
    await writeFile(join(root, '.changeset', 'leftover.md'), changeset);
  }
  return root;
}

function runChecker(root) {
  return spawnSync(process.execPath, [checkerPath], {
    cwd: root,
    env: { ...process.env, EXPECTED_RELEASE_VERSION: '5.1.0' },
    encoding: 'utf8',
  });
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test('accepts the exact reviewed ten-package and five-publish release manifest', async () => {
  const result = runChecker(await createFixture());
  assert.equal(result.status, 0, result.stderr);
});

test('rejects version drift in every package, including packages omitted by the legacy checker', async () => {
  const definitions = packageDefinitions.map((definition) =>
    definition.name === '@buzzr/dfs-cli' ? { ...definition, version: '9.9.9' } : definition,
  );
  const result = runChecker(await createFixture({ definitions }));
  assert.notEqual(result.status, 0, result.stdout);
});

test('rejects an unauthorized sixth publish', async () => {
  const release = releaseManifest();
  release.packages = release.packages.map((definition) =>
    definition.name === '@buzzr/bets-core' ? { ...definition, publish: true } : definition,
  );
  const result = runChecker(await createFixture({ manifest: release }));
  assert.notEqual(result.status, 0, result.stdout);
});

test('rejects internal dependency range drift anywhere in the workspace', async () => {
  const definitions = packageDefinitions.map((definition) =>
    definition.name === '@buzzr/dfs-provider-espn'
      ? { ...definition, dependencies: { '@buzzr/dfs-engine': '*' } }
      : definition,
  );
  const result = runChecker(await createFixture({ definitions }));
  assert.notEqual(result.status, 0, result.stdout);
});

test('rejects a remaining release changeset after versioning', async () => {
  const result = runChecker(
    await createFixture({ changeset: '---\n"@buzzr/mcp": patch\n---\n\nNot versioned.\n' }),
  );
  assert.notEqual(result.status, 0, result.stdout);
});
