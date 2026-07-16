import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const argumentsByName = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  assert(name?.startsWith('--') && value, 'Arguments must be --name value pairs');
  argumentsByName.set(name, value);
}

const destination = argumentsByName.get('--destination');
const output = argumentsByName.get('--output');
assert(destination, '--destination is required');
assert(output, '--output is required');

const release = JSON.parse(await readFile('release-manifest.json', 'utf8'));
const packages = release.packages.filter((entry) => entry.publish);
assert.equal(packages.length, 5, 'exactly five release artifacts must be packed');
await Promise.all([
  mkdir(resolve(destination), { recursive: true }),
  mkdir(dirname(resolve(output)), { recursive: true }),
]);

function npmCommand(args) {
  if (process.env.npm_execpath) {
    return { command: process.execPath, args: [process.env.npm_execpath, ...args] };
  }
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args };
}

async function pack(entry) {
  const command = npmCommand([
    'pack',
    '--workspace',
    entry.name,
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    resolve(destination),
  ]);
  const { stdout } = await execFileAsync(command.command, command.args, {
    maxBuffer: 20 * 1_024 * 1_024,
  });
  const jsonStart = stdout.lastIndexOf('\n[');
  const packed = JSON.parse(jsonStart === -1 ? stdout : stdout.slice(jsonStart + 1));
  assert.equal(packed.length, 1, `expected one artifact for ${entry.name}`);
  const artifact = packed[0];
  assert.equal(artifact.name, entry.name, `packed the wrong workspace for ${entry.name}`);
  assert.equal(artifact.version, entry.version, `${entry.name} packed at the wrong version`);
  assert(
    artifact.files.some((file) => file.path === 'package.json'),
    `${entry.name} artifact is missing package.json`,
  );
  assert(
    artifact.files.some((file) => file.path === 'dist/index.js'),
    `${entry.name} artifact is missing dist/index.js`,
  );
  const bytes = await readFile(resolve(destination, artifact.filename));
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  return {
    name: entry.name,
    version: entry.version,
    filename: artifact.filename,
    integrity,
    size: bytes.byteLength,
  };
}

const artifacts = [];
for (const entry of packages) {
  artifacts.push(await pack(entry));
}

await writeFile(resolve(output), `${JSON.stringify(artifacts, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(artifacts)}\n`);
