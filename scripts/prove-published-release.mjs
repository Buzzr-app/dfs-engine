import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { parseNpmViewMetadata } from './lib/npm-view-output.mjs';

const execFileAsync = promisify(execFile);
const expectedCommit = process.env.EXPECTED_RELEASE_COMMIT?.trim();
const expectedIntegritiesJson = process.env.EXPECTED_RELEASE_INTEGRITIES?.trim();
const releaseManifestPath = process.env.EXPECTED_RELEASE_MANIFEST_PATH?.trim();
const expectedReleaseManifestSha512 = process.env.EXPECTED_RELEASE_MANIFEST_SHA512?.trim();
assert.match(expectedCommit ?? '', /^[0-9a-f]{40}$/, 'EXPECTED_RELEASE_COMMIT is required');
assert(expectedIntegritiesJson, 'EXPECTED_RELEASE_INTEGRITIES is required');
assert(releaseManifestPath, 'EXPECTED_RELEASE_MANIFEST_PATH is required');
assert.match(
  expectedReleaseManifestSha512 ?? '',
  /^[0-9a-f]{128}$/,
  'EXPECTED_RELEASE_MANIFEST_SHA512 is required',
);

const releaseManifest = await readFile(releaseManifestPath);
assert.equal(
  createHash('sha512').update(releaseManifest).digest('hex'),
  expectedReleaseManifestSha512,
  'release manifest changed after authorization',
);
const release = JSON.parse(releaseManifest.toString('utf8'));
const packages = release.packages.filter((entry) => entry.publish);
const expectedIntegrities = JSON.parse(expectedIntegritiesJson);
assert.deepEqual(
  Object.keys(expectedIntegrities).sort(),
  packages.map((entry) => entry.name).sort(),
  'integrity map must cover exactly the five published packages',
);
for (const integrity of Object.values(expectedIntegrities)) {
  assert.match(integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/);
}

const registryUrl = new URL(release.registry.npm);
const registry = `${registryUrl.origin}/`;
assert.equal(registry, release.registry.npm, 'npm registry must be a canonical HTTPS origin');

function npmCommand(args) {
  if (process.env.npm_execpath) {
    return { command: process.execPath, args: [process.env.npm_execpath, ...args] };
  }
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args };
}

async function execNpm(args, { cwd, env }) {
  const command = npmCommand(args);
  return execFileAsync(command.command, command.args, {
    cwd,
    env,
    maxBuffer: 20 * 1_024 * 1_024,
  });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'buzzr-release-proof/5.1' },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.ok, true, `${url} returned HTTP ${response.status}`);
  return response.json();
}

function decodeStatement(attestation) {
  const payload = attestation?.bundle?.dsseEnvelope?.payload;
  assert.equal(typeof payload, 'string', 'attestation is missing its signed DSSE payload');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function packagePurl(name, version) {
  const path = name.startsWith('@') ? `%40${name.slice(1)}` : name;
  return `pkg:npm/${path}@${version}`;
}

function integrityHex(integrity) {
  return Buffer.from(integrity.slice('sha512-'.length), 'base64').toString('hex');
}

function assertSubject(statement, entry, integrity) {
  const subject = statement.subject?.find(
    (candidate) => candidate.name === packagePurl(entry.name, entry.version),
  );
  assert(subject, `${entry.name} attestation subject is missing`);
  assert.equal(subject.digest?.sha512, integrityHex(integrity), `${entry.name} digest drifted`);
}

async function provePackage(entry, environment, cwd) {
  const spec = `${entry.name}@${entry.version}`;
  const { stdout } = await execNpm(['view', spec, '--json', '--registry', registry], {
    cwd,
    env: environment,
  });
  const metadata = parseNpmViewMetadata(stdout, entry.name);
  const expectedIntegrity = expectedIntegrities[entry.name];
  assert.equal(metadata.name, entry.name);
  assert.equal(metadata.version, entry.version);
  assert.equal(metadata.gitHead, expectedCommit, `${spec} gitHead drifted`);
  assert.equal(metadata.dist?.integrity, expectedIntegrity, `${spec} integrity drifted`);
  assert(Array.isArray(metadata.dist?.signatures) && metadata.dist.signatures.length > 0);

  const tarball = new URL(metadata.dist.tarball);
  assert.equal(
    tarball.origin,
    registryUrl.origin,
    `${spec} tarball came from an unexpected registry`,
  );
  const attestationUrl = new URL(metadata.dist.attestations?.url);
  assert.equal(
    attestationUrl.origin,
    registryUrl.origin,
    `${spec} attestations came from an unexpected registry`,
  );
  assert.equal(
    metadata.dist.attestations?.provenance?.predicateType,
    'https://slsa.dev/provenance/v1',
    `${spec} is missing SLSA provenance`,
  );

  const response = await fetchJson(attestationUrl);
  assert(Array.isArray(response.attestations), `${spec} attestation response is malformed`);
  const publishAttestation = response.attestations.find(
    (candidate) =>
      candidate.predicateType === 'https://github.com/npm/attestation/tree/main/specs/publish/v0.1',
  );
  const provenanceAttestation = response.attestations.find(
    (candidate) => candidate.predicateType === 'https://slsa.dev/provenance/v1',
  );
  assert(publishAttestation, `${spec} is missing npm publish provenance`);
  assert(provenanceAttestation, `${spec} is missing GitHub Actions provenance`);

  const publishStatement = decodeStatement(publishAttestation);
  assertSubject(publishStatement, entry, expectedIntegrity);
  assert.equal(publishStatement.predicate?.name, entry.name);
  assert.equal(publishStatement.predicate?.version, entry.version);
  assert.equal(publishStatement.predicate?.registry, registryUrl.origin);

  const provenanceStatement = decodeStatement(provenanceAttestation);
  assertSubject(provenanceStatement, entry, expectedIntegrity);
  const workflow = provenanceStatement.predicate?.buildDefinition?.externalParameters?.workflow;
  assert.equal(workflow?.repository, release.registry.repository);
  assert.equal(workflow?.path, release.registry.workflowPath);
  assert.equal(workflow?.ref, release.registry.ref);
  const dependencies = provenanceStatement.predicate?.buildDefinition?.resolvedDependencies ?? [];
  assert(
    dependencies.some((dependency) => dependency.digest?.gitCommit === expectedCommit),
    `${spec} provenance is not bound to the reviewed commit`,
  );
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'buzzr-published-release-'));
const paths = {
  home: join(temporaryRoot, 'home'),
  appData: join(temporaryRoot, 'app-data'),
  localAppData: join(temporaryRoot, 'local-app-data'),
  temp: join(temporaryRoot, 'temp'),
  cache: join(temporaryRoot, 'npm-cache'),
  userConfig: join(temporaryRoot, 'home', '.npmrc'),
  globalConfig: join(temporaryRoot, 'home', 'global.npmrc'),
  consumer: join(temporaryRoot, 'consumer'),
};

const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !/^(?:NPM_TOKEN|NODE_AUTH_TOKEN|NPM_CONFIG_.*AUTH.*)$/i.test(name),
  ),
);
const environment = {
  ...inheritedEnvironment,
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
  npm_config_registry: registry,
  npm_config_fund: 'false',
  npm_config_audit: 'false',
  npm_config_update_notifier: 'false',
};

try {
  await Promise.all(
    [paths.home, paths.appData, paths.localAppData, paths.temp, paths.cache, paths.consumer].map(
      (path) => mkdir(path, { recursive: true }),
    ),
  );
  await Promise.all([
    writeFile(paths.userConfig, `registry=${registry}\n`),
    writeFile(paths.globalConfig, `registry=${registry}\n`),
    writeFile(
      join(paths.consumer, 'package.json'),
      `${JSON.stringify({ name: 'buzzr-live-release-proof', private: true }, null, 2)}\n`,
    ),
  ]);

  const configuredRegistry = await execNpm(['config', 'get', 'registry'], {
    cwd: paths.consumer,
    env: environment,
  });
  assert.equal(configuredRegistry.stdout.trim(), registry);

  for (const entry of packages) {
    await provePackage(entry, environment, paths.consumer);
  }

  const exactSpecs = packages.map((entry) => `${entry.name}@${entry.version}`);
  await execNpm(
    [
      'install',
      '--ignore-scripts',
      '--package-lock=true',
      '--save-exact',
      '--no-audit',
      '--no-fund',
      ...exactSpecs,
    ],
    { cwd: paths.consumer, env: environment },
  );
  await execNpm(['ls', '--all'], { cwd: paths.consumer, env: environment });
  for (const entry of packages) {
    const installedDirectory = join(paths.consumer, 'node_modules', ...entry.name.split('/'));
    assert.equal((await lstat(installedDirectory)).isSymbolicLink(), false);
    const installed = JSON.parse(await readFile(join(installedDirectory, 'package.json'), 'utf8'));
    assert.equal(installed.name, entry.name);
    assert.equal(installed.version, entry.version);
  }
  await execNpm(['audit', 'signatures'], { cwd: paths.consumer, env: environment });

  process.stdout.write(
    `Proved ${packages.length} exact npm versions, integrities, gitHeads, registry origins, signed provenance statements, and clean-install signatures from ${expectedCommit}.\n`,
  );
} finally {
  if (process.env.KEEP_BUZZR_PUBLISHED_PROOF === '1') {
    process.stderr.write(`Kept published release proof at ${temporaryRoot}\n`);
  } else {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
