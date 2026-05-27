import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');

function readPackageJson(path: string): {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

describe('release guardrails', () => {
  test('keeps release-hardening scripts wired at the workspace root', () => {
    const rootPackage = readPackageJson('package.json');

    expect(rootPackage.scripts).toMatchObject({
      verify: expect.stringContaining('smoke:exports'),
      'test:coverage': expect.stringContaining('--coverage'),
      'smoke:exports': 'node scripts/smoke-exports.mjs',
      'size:check': 'node scripts/check-package-size.mjs',
      'audit:high': 'npm audit --audit-level=high',
    });
  });

  test('keeps runtime dependencies intentionally tiny', () => {
    const betsCore = readPackageJson('packages/bets-core/package.json');
    const engine = readPackageJson('packages/dfs-engine/package.json');
    const espn = readPackageJson('packages/dfs-provider-espn/package.json');
    const testkit = readPackageJson('packages/dfs-testkit/package.json');

    expect(betsCore.dependencies ?? {}).toEqual({});
    expect(engine.dependencies ?? {}).toEqual({});
    expect(Object.keys(espn.dependencies ?? {})).toEqual(['@buzzr/dfs-engine']);
    expect(Object.keys(testkit.dependencies ?? {})).toEqual(['@buzzr/dfs-engine']);
  });
});
