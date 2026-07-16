import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const tarballPath = process.argv[2];
assert(tarballPath, 'Usage: node scripts/compute-npm-integrity.mjs <tarball.tgz>');

const digest = createHash('sha512')
  .update(await readFile(tarballPath))
  .digest('base64');
process.stdout.write(`sha512-${digest}\n`);
