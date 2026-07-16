import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseNpmPackArtifacts } from '../scripts/lib/npm-pack-output.mjs';

const artifact = {
  name: '@buzzr/mcp',
  version: '5.1.0',
  filename: 'buzzr-mcp-5.1.0.tgz',
  files: [{ path: 'package.json', mode: 0o644 }],
};

test('parses the npm 10 and npm 11 array response after lifecycle output', () => {
  const output = `build completed\n${JSON.stringify([artifact], null, 2)}\n`;
  assert.deepEqual(parseNpmPackArtifacts(output, '@buzzr/mcp'), [artifact]);
});

test('normalizes the npm 12 workspace-keyed response', () => {
  const output = JSON.stringify({ '@buzzr/mcp': artifact }, null, 2);
  assert.deepEqual(parseNpmPackArtifacts(output, '@buzzr/mcp'), [artifact]);
});

test('rejects a keyed response for a different workspace', () => {
  const output = JSON.stringify({ '@buzzr/dfs-engine': artifact });
  assert.throws(
    () => parseNpmPackArtifacts(output, '@buzzr/mcp'),
    /Expected npm pack output for @buzzr\/mcp/,
  );
});

test('rejects an array response for a different workspace', () => {
  const output = JSON.stringify([{ ...artifact, name: '@buzzr/dfs-engine' }]);
  assert.throws(
    () => parseNpmPackArtifacts(output, '@buzzr/mcp'),
    /Packed the wrong workspace for @buzzr\/mcp/,
  );
});

test('rejects multiple packed artifacts', () => {
  const output = JSON.stringify([artifact, { ...artifact, name: '@buzzr/dfs-engine' }]);
  assert.throws(
    () => parseNpmPackArtifacts(output, '@buzzr/mcp'),
    /Expected one packed artifact for @buzzr\/mcp/,
  );
});

test('rejects output without a JSON result', () => {
  assert.throws(
    () => parseNpmPackArtifacts('npm lifecycle output only', '@buzzr/mcp'),
    /Could not parse npm pack JSON output for @buzzr\/mcp/,
  );
});
