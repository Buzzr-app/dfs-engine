import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseNpmViewMetadata, parseNpmViewValue } from '../scripts/lib/npm-view-output.mjs';

const metadata = {
  name: '@buzzr/dfs-cli',
  version: '5.0.1',
  gitHead: 'c26ad054f999ea726eb29c93d75e5a0dd8a7ea7e',
  dist: { integrity: 'sha512-example' },
};

test('parses the npm 10 and npm 11 metadata object', () => {
  assert.deepEqual(parseNpmViewMetadata(JSON.stringify(metadata), '@buzzr/dfs-cli'), metadata);
});

test('normalizes the npm 12 exact-version metadata array', () => {
  assert.deepEqual(parseNpmViewMetadata(JSON.stringify([metadata]), '@buzzr/dfs-cli'), metadata);
});

test('rejects an empty metadata array', () => {
  assert.throws(
    () => parseNpmViewMetadata('[]', '@buzzr/dfs-cli'),
    /Expected one npm view result for @buzzr\/dfs-cli/,
  );
});

test('rejects multiple metadata entries', () => {
  assert.throws(
    () => parseNpmViewMetadata(JSON.stringify([metadata, metadata]), '@buzzr/dfs-cli'),
    /Expected one npm view result for @buzzr\/dfs-cli/,
  );
});

test('rejects metadata for a different package', () => {
  const output = JSON.stringify([{ ...metadata, name: '@buzzr/dfs-engine' }]);
  assert.throws(
    () => parseNpmViewMetadata(output, '@buzzr/dfs-cli'),
    /Viewed the wrong package for @buzzr\/dfs-cli/,
  );
});

test('parses npm 10 and npm 11 scalar field output', () => {
  assert.equal(parseNpmViewValue(JSON.stringify('5.1.0'), 'dist-tags.latest'), '5.1.0');
});

test('normalizes npm 12 exact-version field output', () => {
  const provenance = { predicateType: 'https://slsa.dev/provenance/v1' };
  assert.deepEqual(
    parseNpmViewValue(JSON.stringify([provenance]), 'dist.attestations.provenance'),
    provenance,
  );
});

test('rejects empty and multiple field results', () => {
  assert.throws(
    () => parseNpmViewValue('[]', 'dist.integrity'),
    /Expected one npm view value for dist\.integrity/,
  );
  assert.throws(
    () => parseNpmViewValue('["first","second"]', 'dist.integrity'),
    /Expected one npm view value for dist\.integrity/,
  );
});
