import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseNpmViewValue } from './lib/npm-view-output.mjs';
import { runMcpb } from './lib/mcpb-cli.mjs';
import {
  createSmitheryManifest,
  SMITHERY_QUALIFIED_NAME,
  smitheryBundleFilename,
} from './lib/smithery-bundle.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const smitheryDirectory = join(root, 'smithery');
const outputDirectory = join(root, 'artifacts', 'smithery');
const maximumBundleBytes = 25 * 1024 * 1024;

function execNpm(args, options) {
  if (process.env.npm_execpath) {
    return execFileAsync(process.execPath, [process.env.npm_execpath, ...args], options);
  }
  return execFileAsync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, options);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'buzzr-smithery-build-'));
const bundleDirectory = join(temporaryRoot, 'bundle');
const serverDirectory = join(bundleDirectory, 'server');
const emptyUserConfig = join(temporaryRoot, 'empty-user.npmrc');
const emptyGlobalConfig = join(temporaryRoot, 'empty-global.npmrc');

try {
  const [runtimeManifest, runtimeLock, source] = await Promise.all(
    ['package.json', 'package-lock.json', 'source.json'].map(async (filename) =>
      JSON.parse(await readFile(join(smitheryDirectory, filename), 'utf8')),
    ),
  );
  assert.equal(source.schemaVersion, 1);
  assert.equal(source.qualifiedName, SMITHERY_QUALIFIED_NAME);
  assert.equal(runtimeManifest.version, source.version);
  assert.equal(runtimeManifest.dependencies[source.package], source.version);

  const lockedMcp = runtimeLock.packages?.[`node_modules/${source.package}`];
  assert(lockedMcp, `${source.package} is missing from the Smithery runtime lockfile`);
  assert.equal(lockedMcp.version, source.version);
  assert.equal(lockedMcp.integrity, source.integrity);
  assert.equal(lockedMcp.resolved, source.tarball);

  await mkdir(serverDirectory, { recursive: true });
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    cp(join(smitheryDirectory, 'package.json'), join(serverDirectory, 'package.json')),
    cp(join(smitheryDirectory, 'package-lock.json'), join(serverDirectory, 'package-lock.json')),
    cp(join(smitheryDirectory, 'source.json'), join(bundleDirectory, 'source.json')),
    cp(join(root, 'packages', 'mcp', 'LICENSE'), join(bundleDirectory, 'LICENSE')),
    cp(join(root, 'packages', 'mcp', 'README.md'), join(bundleDirectory, 'README.md')),
    writeFile(emptyUserConfig, '', { mode: 0o600 }),
    writeFile(emptyGlobalConfig, '', { mode: 0o600 }),
  ]);

  const registryEnvironment = {
    ...process.env,
    NO_COLOR: '1',
    NPM_CONFIG_AUDIT: 'false',
    NPM_CONFIG_FUND: 'false',
    NPM_CONFIG_GLOBALCONFIG: emptyGlobalConfig,
    NPM_CONFIG_REGISTRY: source.registry,
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    NPM_CONFIG_USERCONFIG: emptyUserConfig,
  };

  const view = await execNpm(
    [
      'view',
      `${source.package}@${source.version}`,
      'version',
      'gitHead',
      'dist.integrity',
      'dist.tarball',
      '--json',
    ],
    { cwd: root, env: registryEnvironment, maxBuffer: 2 * 1024 * 1024 },
  );
  const live = parseNpmViewValue(view.stdout, `${source.package}@${source.version}`);
  assert.equal(live.version, source.version, 'Published MCP version changed');
  assert.equal(live.gitHead, source.gitHead, 'Published MCP gitHead changed');
  assert.equal(live['dist.integrity'], source.integrity, 'Published MCP integrity changed');
  assert.equal(live['dist.tarball'], source.tarball, 'Published MCP tarball changed');

  await execNpm(['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: serverDirectory,
    env: {
      ...registryEnvironment,
      npm_config_cache: join(temporaryRoot, 'npm-cache'),
    },
    maxBuffer: 20 * 1024 * 1024,
  });
  await rm(join(serverDirectory, 'node_modules', '.bin'), { recursive: true, force: true });

  const installedPackagePath = join(serverDirectory, 'node_modules', ...source.package.split('/'));
  const installedManifest = JSON.parse(
    await readFile(join(installedPackagePath, 'package.json'), 'utf8'),
  );
  assert.equal(installedManifest.name, source.package);
  assert.equal(installedManifest.version, source.version);
  assert.equal(installedManifest.gitHead, source.gitHead);

  const installedModule = await import(
    `${pathToFileURL(join(installedPackagePath, 'dist', 'index.js')).href}?bundle=${Date.now()}`
  );
  const tools = installedModule.allTools.map(({ name, description }) => ({ name, description }));
  assert.equal(tools.length, 11, 'Smithery bundle must expose exactly 11 Buzzr tools');

  const manifest = createSmitheryManifest({ version: source.version, tools });
  await Promise.all([
    writeFile(join(bundleDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(
      join(serverDirectory, 'index.js'),
      "import './node_modules/@buzzr/mcp/dist/cli.js';\n",
    ),
  ]);

  await runMcpb(['validate', join(bundleDirectory, 'manifest.json')], {
    cwd: root,
    env: {
      NPM_CONFIG_CACHE: join(temporaryRoot, 'mcpb-cache'),
      NPM_CONFIG_GLOBALCONFIG: emptyGlobalConfig,
      NPM_CONFIG_REGISTRY: source.registry,
      NPM_CONFIG_USERCONFIG: emptyUserConfig,
    },
  });

  const artifactPath = join(outputDirectory, smitheryBundleFilename(source.version));
  const metadataPath = `${artifactPath}.json`;
  await Promise.all([rm(artifactPath, { force: true }), rm(metadataPath, { force: true })]);
  await runMcpb(['pack', bundleDirectory, artifactPath], {
    cwd: root,
    env: {
      NPM_CONFIG_CACHE: join(temporaryRoot, 'mcpb-cache'),
      NPM_CONFIG_GLOBALCONFIG: emptyGlobalConfig,
      NPM_CONFIG_REGISTRY: source.registry,
      NPM_CONFIG_USERCONFIG: emptyUserConfig,
    },
  });

  const artifact = await readFile(artifactPath);
  const artifactStat = await stat(artifactPath);
  assert.equal(artifactStat.isFile(), true);
  assert(
    artifactStat.size <= maximumBundleBytes,
    `Smithery bundle exceeds ${maximumBundleBytes} bytes`,
  );

  const metadata = {
    schemaVersion: 1,
    qualifiedName: source.qualifiedName,
    artifact: basename(artifactPath),
    version: source.version,
    sha256: sha256(artifact),
    size: artifactStat.size,
    toolCount: tools.length,
    npm: {
      package: source.package,
      version: source.version,
      gitHead: source.gitHead,
      integrity: source.integrity,
    },
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ artifactPath, metadataPath, ...metadata })}\n`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
