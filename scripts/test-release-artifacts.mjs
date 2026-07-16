import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packages = [
  { name: '@buzzr/bets-core', exportName: 'normalizeSportsbookSlug' },
  { name: '@buzzr/dfs-cli', exportName: 'runGradeFromFiles', cjs: false },
  { name: '@buzzr/dfs-engine', exportName: 'createDfsEngine' },
  { name: '@buzzr/dfs-engine-test-vectors', exportName: 'TEST_VECTORS' },
  { name: '@buzzr/dfs-provider-espn', exportName: 'createEspnStatProvider' },
  {
    name: '@buzzr/dfs-provider-sportradar',
    exportName: 'createSportradarStatProvider',
  },
  { name: '@buzzr/dfs-react', exportName: 'getSlipDisplayModel' },
  { name: '@buzzr/dfs-testkit', exportName: 'makeDfsEntry' },
  { name: '@buzzr/entertainment-engine', exportName: 'resolveBuzzScores' },
  { name: '@buzzr/mcp', exportName: 'createBuzzrMcpServer', cjs: false },
];

function npmCommand(args) {
  if (process.env.npm_execpath) {
    return { command: process.execPath, args: [process.env.npm_execpath, ...args] };
  }
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args };
}

async function execNpm(args, options = {}) {
  const command = npmCommand(args);
  return execFileAsync(command.command, command.args, {
    cwd: root,
    maxBuffer: 40 * 1_024 * 1_024,
    ...options,
  });
}

function commandEnvironment(paths) {
  return {
    ...process.env,
    HOME: paths.home,
    USERPROFILE: paths.home,
    APPDATA: paths.appData,
    LOCALAPPDATA: paths.localAppData,
    TEMP: paths.temp,
    TMP: paths.temp,
    TMPDIR: paths.temp,
    NO_COLOR: '1',
    npm_config_cache: paths.cache,
    npm_config_userconfig: paths.userConfig,
    npm_config_globalconfig: paths.globalConfig,
    npm_config_registry: 'https://registry.npmjs.org/',
    npm_config_fund: 'false',
    npm_config_audit: 'false',
    npm_config_update_notifier: 'false',
  };
}

async function packWorkspace(packageName, destination, environment) {
  const { stdout } = await execNpm(
    ['pack', '--workspace', packageName, '--json', '--pack-destination', destination],
    { env: environment },
  );
  const jsonStart = stdout.lastIndexOf('\n[');
  const result = JSON.parse(jsonStart === -1 ? stdout : stdout.slice(jsonStart + 1));
  assert.equal(result.length, 1, `Expected one packed artifact for ${packageName}`);
  assert.equal(result[0].name, packageName, `Packed the wrong workspace for ${packageName}`);
  assert(
    result[0].files.some((file) => file.path === 'package.json'),
    `${packageName} tarball is missing package.json`,
  );
  assert(
    result[0].files.some((file) => file.path === 'dist/index.js'),
    `${packageName} tarball is missing dist/index.js`,
  );
  return result[0];
}

function packageDirectory(consumerDirectory, packageName) {
  return join(consumerDirectory, 'node_modules', ...packageName.split('/'));
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'buzzr-release-artifacts-'));
const paths = {
  home: join(temporaryRoot, 'home'),
  appData: join(temporaryRoot, 'app-data'),
  localAppData: join(temporaryRoot, 'local-app-data'),
  temp: join(temporaryRoot, 'temp'),
  cache: join(temporaryRoot, 'npm-cache'),
  userConfig: join(temporaryRoot, 'home', '.npmrc'),
  globalConfig: join(temporaryRoot, 'home', 'global.npmrc'),
};
const packsDirectory = join(temporaryRoot, 'packs');
const consumerDirectory = join(temporaryRoot, 'consumer');
const environment = commandEnvironment(paths);

try {
  for (const directory of [
    paths.home,
    paths.appData,
    paths.localAppData,
    paths.temp,
    paths.cache,
    packsDirectory,
    consumerDirectory,
  ]) {
    await mkdir(directory, { recursive: true });
  }
  await Promise.all([
    writeFile(paths.userConfig, 'registry=https://registry.npmjs.org/\n'),
    writeFile(paths.globalConfig, 'registry=https://registry.npmjs.org/\n'),
    writeFile(
      join(consumerDirectory, 'package.json'),
      `${JSON.stringify({ name: 'buzzr-packed-release-consumer', private: true }, null, 2)}\n`,
    ),
  ]);

  await execNpm(['run', 'build'], { env: environment });

  const packed = [];
  for (const packageDefinition of packages) {
    packed.push(await packWorkspace(packageDefinition.name, packsDirectory, environment));
  }

  const tarballs = packed.map((artifact) => join(packsDirectory, artifact.filename));
  await execNpm(
    ['install', '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund', ...tarballs],
    { cwd: consumerDirectory, env: environment },
  );
  await execNpm(['ls', '--all'], { cwd: consumerDirectory, env: environment });

  const expectedVersions = {};
  for (const artifact of packed) {
    const installedDirectory = packageDirectory(consumerDirectory, artifact.name);
    assert.equal(
      (await lstat(installedDirectory)).isSymbolicLink(),
      false,
      `${artifact.name} resolved to a workspace link instead of the packed artifact`,
    );
    const manifest = JSON.parse(await readFile(join(installedDirectory, 'package.json'), 'utf8'));
    assert.equal(manifest.name, artifact.name);
    assert.equal(manifest.version, artifact.version);
    expectedVersions[artifact.name] = artifact.version;
  }

  const verifierPath = join(consumerDirectory, 'verify-packed-imports.mjs');
  await writeFile(
    verifierPath,
    `import assert from 'node:assert/strict';\n` +
      `import { createRequire } from 'node:module';\n` +
      `const require = createRequire(import.meta.url);\n` +
      `const probes = ${JSON.stringify(packages)};\n` +
      `const expectedVersions = ${JSON.stringify(expectedVersions)};\n` +
      `for (const probe of probes) {\n` +
      `  const loaded = await import(probe.name);\n` +
      `  assert.notEqual(loaded[probe.exportName], undefined, probe.name + ' missing ' + probe.exportName);\n` +
      `  if (probe.cjs !== false) {\n` +
      `    const required = require(probe.name);\n` +
      `    assert.notEqual(required[probe.exportName], undefined, probe.name + ' CJS missing ' + probe.exportName);\n` +
      `  }\n` +
      `}\n` +
      `const enginePackage = await import('@buzzr/dfs-engine');\n` +
      `const vectors = await import('@buzzr/dfs-engine-test-vectors');\n` +
      `for (const vector of vectors.TEST_VECTORS) {\n` +
      `  const provider = enginePackage.defineStatProvider({\n` +
      `    id: 'packed-vector-provider',\n` +
      `    getGameLog: ({ leg }) => vector.gameLogsByLegId[leg.legId] ?? [],\n` +
      `  });\n` +
      `  const engine = enginePackage.createDfsEngine({ statProviders: [provider] });\n` +
      `  const result = await engine.settleEntry(vector.entry, {\n` +
      `    statProviderId: provider.id,\n` +
      `    settledAt: '2026-07-16T12:00:00.000Z',\n` +
      `  });\n` +
      `  assert.equal(result.status, vector.expected.status, vector.name + ' status drifted');\n` +
      `}\n` +
      `const testkit = await import('@buzzr/dfs-testkit');\n` +
      `const fixtureEntry = testkit.makeDfsEntry({\n` +
      `  legs: [\n` +
      `    testkit.makeDfsLeg({ legId: 'packed-leg-1', actual: 31 }),\n` +
      `    testkit.makeDfsLeg({ legId: 'packed-leg-2', actual: 32 }),\n` +
      `  ],\n` +
      `});\n` +
      `const fixtureResult = await enginePackage.createDfsEngine().settleEntry(fixtureEntry);\n` +
      `assert.equal(fixtureResult.status, 'won');\n` +
      `const espn = await import('@buzzr/dfs-provider-espn');\n` +
      `assert.equal(espn.createEspnStatProvider({ getGameLog: () => [] }).id, 'espn');\n` +
      `const sportradar = await import('@buzzr/dfs-provider-sportradar');\n` +
      `assert.equal(sportradar.createSportradarStatProvider({ getGameLog: () => [] }).id, 'sportradar');\n` +
      `assert.equal(sportradar.sportradarRowToGameLog({ points: 12 }).points, '12');\n` +
      `const react = await import('@buzzr/dfs-react');\n` +
      `assert.equal(react.getSlipDisplayModel(fixtureResult).tone, 'win');\n` +
      `const mcp = await import('@buzzr/mcp');\n` +
      `assert.equal(mcp.allTools.length, 11);\n` +
      `assert(vectors.TEST_VECTORS.length >= 11);\n` +
      `assert.equal(Object.keys(expectedVersions).length, probes.length);\n`,
  );
  await execFileAsync(process.execPath, [verifierPath], {
    cwd: consumerDirectory,
    env: environment,
    maxBuffer: 10 * 1_024 * 1_024,
  });

  const typeConsumerPath = join(consumerDirectory, 'typecheck-consumer.ts');
  const typeConfigPath = join(consumerDirectory, 'tsconfig.json');
  await Promise.all([
    writeFile(
      typeConsumerPath,
      `import { createDfsEngine, type DfsSettlementResult } from '@buzzr/dfs-engine';\n` +
        `import { TEST_VECTORS } from '@buzzr/dfs-engine-test-vectors';\n` +
        `import { createEspnStatProvider } from '@buzzr/dfs-provider-espn';\n` +
        `import { createSportradarStatProvider } from '@buzzr/dfs-provider-sportradar';\n` +
        `import { getSlipDisplayModel } from '@buzzr/dfs-react';\n` +
        `import { makeDfsEntry } from '@buzzr/dfs-testkit';\n` +
        `import { runGradeFromFiles } from '@buzzr/dfs-cli';\n` +
        `import { normalizeSportsbookSlug } from '@buzzr/bets-core';\n` +
        `import { resolveBuzzScores } from '@buzzr/entertainment-engine';\n` +
        `import { createBuzzrMcpServer } from '@buzzr/mcp';\n` +
        `const engine = createDfsEngine();\n` +
        `engine.getBookPolicies();\n` +
        `const result = null as DfsSettlementResult | null;\n` +
        `void [TEST_VECTORS, createEspnStatProvider, createSportradarStatProvider, getSlipDisplayModel, makeDfsEntry, runGradeFromFiles, normalizeSportsbookSlug, resolveBuzzScores, createBuzzrMcpServer, result];\n`,
    ),
    writeFile(
      typeConfigPath,
      `${JSON.stringify(
        {
          compilerOptions: {
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            target: 'ES2022',
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            types: [],
          },
          files: ['./typecheck-consumer.ts'],
        },
        null,
        2,
      )}\n`,
    ),
  ]);
  await execFileAsync(
    process.execPath,
    [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', typeConfigPath],
    {
      cwd: consumerDirectory,
      env: environment,
      maxBuffer: 10 * 1_024 * 1_024,
    },
  );

  const executableSuffix = process.platform === 'win32' ? '.cmd' : '';
  const executableMode = process.platform === 'win32' ? undefined : fsConstants.X_OK;
  for (const executable of ['dfs-grade', 'mcp', 'buzzr-mcp']) {
    await access(
      join(consumerDirectory, 'node_modules', '.bin', `${executable}${executableSuffix}`),
      executableMode,
    );
  }
  const cli = await execNpm(['exec', '--offline', '--', 'dfs-grade', '--help'], {
    cwd: consumerDirectory,
    env: environment,
  });
  assert.match(cli.stdout, /dfs-grade <entry\.json>/);

  process.stdout.write(
    `Packed release ecosystem passed: ${packed.length} clean-installed packages, ESM/CJS/types, vector replay, provider/testkit/react integration, three bins, and 11 MCP tools.\n`,
  );
} finally {
  if (process.env.KEEP_BUZZR_PACKED_ARTIFACTS === '1') {
    process.stderr.write(`Kept packed release proof at ${temporaryRoot}\n`);
  } else {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
