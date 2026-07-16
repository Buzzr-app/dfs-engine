import assert from 'node:assert/strict';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, posix, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { unzipSync, zipSync } from 'fflate';

const schemaPath = fileURLToPath(
  new URL('../../smithery/mcpb-manifest-v0.4.schema.json', import.meta.url),
);
const archiveEpoch = new Date('1980-01-02T00:00:00.000Z');
const maximumArchiveEntries = 20_000;
const maximumExtractedBytes = 100 * 1024 * 1024;

function safeArchiveName(name) {
  assert(name.length > 0, 'MCPB contains an empty archive path');
  assert(!name.includes('\0'), 'MCPB archive path contains a null byte');
  assert(!name.includes('\\'), `MCPB archive path uses a backslash: ${name}`);
  assert(!posix.isAbsolute(name), `MCPB archive path is absolute: ${name}`);
  assert(!/^[A-Za-z]:/.test(name), `MCPB archive path uses a drive prefix: ${name}`);
  assert.equal(posix.normalize(name), name, `MCPB archive path is not normalized: ${name}`);
  assert(!name.startsWith('../') && !name.includes('/../'), `MCPB archive path escapes: ${name}`);
  return name;
}

function endOfCentralDirectory(archive) {
  const minimumOffset = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('MCPB has no ZIP end-of-central-directory record');
}

export function inspectMcpbArchive(bytes) {
  const archive = Buffer.from(bytes);
  assert(archive.length >= 22, 'MCPB is too small to be a ZIP archive');
  const endOffset = endOfCentralDirectory(archive);
  assert.equal(archive.readUInt16LE(endOffset + 4), 0, 'Multi-disk MCPB archives are unsupported');
  assert.equal(archive.readUInt16LE(endOffset + 6), 0, 'Multi-disk MCPB archives are unsupported');
  const diskEntries = archive.readUInt16LE(endOffset + 8);
  const totalEntries = archive.readUInt16LE(endOffset + 10);
  assert.equal(diskEntries, totalEntries, 'Multi-disk MCPB archives are unsupported');
  assert(totalEntries < 0xffff, 'ZIP64 MCPB archives are unsupported');
  assert(totalEntries <= maximumArchiveEntries, 'MCPB contains too many archive entries');
  const centralSize = archive.readUInt32LE(endOffset + 12);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  assert(
    centralOffset + centralSize <= endOffset,
    'MCPB central directory is outside the archive',
  );

  let cursor = centralOffset;
  let totalBytes = 0;
  const entries = [];
  const names = new Set();
  for (let index = 0; index < totalEntries; index += 1) {
    assert.equal(
      archive.readUInt32LE(cursor),
      0x02014b50,
      'MCPB central directory entry is invalid',
    );
    const flags = archive.readUInt16LE(cursor + 8);
    const compression = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const externalAttributes = archive.readUInt32LE(cursor + 38);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    assert(next <= centralOffset + centralSize, 'MCPB central directory entry is truncated');
    assert.equal(flags & 1, 0, 'Encrypted MCPB entries are unsupported');
    assert(
      compression === 0 || compression === 8,
      `Unsupported MCPB compression method: ${compression}`,
    );
    assert(localOffset + 30 <= centralOffset, 'MCPB local file header is outside the archive');
    assert.equal(archive.readUInt32LE(localOffset), 0x04034b50, 'MCPB local file header is invalid');

    const name = safeArchiveName(
      archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'),
    );
    assert(!names.has(name), `MCPB contains a duplicate archive path: ${name}`);
    names.add(name);
    const unixFileType = Math.floor(externalAttributes / 65_536) & 0o170000;
    assert.notEqual(unixFileType, 0o120000, `MCPB contains a symbolic link: ${name}`);
    totalBytes += uncompressedSize;
    assert(totalBytes <= maximumExtractedBytes, 'MCPB declared content is too large');
    entries.push({ name, compressedSize, uncompressedSize });
    cursor = next;
  }
  assert.equal(cursor, centralOffset + centralSize, 'MCPB central directory size is inconsistent');
  return Object.freeze({ entries: Object.freeze(entries), totalBytes });
}

async function collectFiles(directory) {
  const files = {};
  let totalBytes = 0;
  async function visit(current, prefix = '') {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(current, entry.name);
      const pathStat = await lstat(path);
      assert.equal(pathStat.isSymbolicLink(), false, `Cannot pack symbolic link: ${path}`);
      const name = safeArchiveName(prefix ? `${prefix}/${entry.name}` : entry.name);
      if (pathStat.isDirectory()) {
        await visit(path, name);
      } else {
        assert.equal(pathStat.isFile(), true, `Cannot pack non-file entry: ${path}`);
        totalBytes += pathStat.size;
        assert(totalBytes <= maximumExtractedBytes, 'MCPB source content is too large');
        files[name] = new Uint8Array(await readFile(path));
      }
    }
  }
  await visit(directory);
  assert(Object.keys(files).length > 0, 'Cannot pack an empty MCPB directory');
  assert(Object.keys(files).length <= maximumArchiveEntries, 'MCPB source has too many files');
  return files;
}

async function validateManifest(path) {
  const [manifest, schema] = await Promise.all(
    [path, schemaPath].map(async (filename) => JSON.parse(await readFile(filename, 'utf8'))),
  );
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(
    validate(manifest),
    true,
    `MCPB manifest is invalid: ${ajv.errorsText(validate.errors)}`,
  );
}

async function pack(directory, artifactPath) {
  const files = await collectFiles(resolve(directory));
  const archive = zipSync(files, { level: 9, mtime: archiveEpoch });
  inspectMcpbArchive(archive);
  await mkdir(dirname(resolve(artifactPath)), { recursive: true });
  await writeFile(resolve(artifactPath), archive, { mode: 0o644 });
}

async function unpack(artifactPath, outputDirectory) {
  const archive = await readFile(resolve(artifactPath));
  const inspected = inspectMcpbArchive(archive);
  const extracted = unzipSync(archive);
  assert.deepEqual(Object.keys(extracted).sort(), inspected.entries.map(({ name }) => name).sort());
  const outputRoot = resolve(outputDirectory);
  let totalBytes = 0;
  for (const [name, data] of Object.entries(extracted)) {
    const path = resolve(outputRoot, name);
    assert(path.startsWith(`${outputRoot}${sep}`), `MCPB archive path escapes output: ${name}`);
    if (name.endsWith('/')) {
      await mkdir(path, { recursive: true });
      continue;
    }
    totalBytes += data.byteLength;
    assert(totalBytes <= maximumExtractedBytes, 'MCPB extracted content is too large');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data, { flag: 'wx', mode: 0o600 });
  }
}

export async function runMcpb(args) {
  assert(Array.isArray(args) && args.every((argument) => typeof argument === 'string'));
  const [command, ...operands] = args;
  if (command === 'validate' && operands.length === 1) {
    await validateManifest(resolve(operands[0]));
  } else if (command === 'pack' && operands.length === 2) {
    await pack(operands[0], operands[1]);
  } else if (command === 'unpack' && operands.length === 2) {
    await unpack(operands[0], operands[1]);
  } else {
    throw new TypeError(`Unsupported MCPB command or arguments: ${command ?? '<missing>'}`);
  }
  return { stdout: '', stderr: '' };
}
