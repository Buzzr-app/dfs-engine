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

function readText(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
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
      'test:mcp:packed': expect.stringContaining('scripts/test-mcp-packed.mjs'),
      'proof:mcp:published': 'node scripts/prove-mcp-published.mjs',
    });
    expect(rootPackage.scripts?.verify).toContain('test:mcp:packed');

    const mcpPackage = readPackageJson('packages/mcp/package.json');
    expect(mcpPackage.scripts?.prepack).toBe('npm run build');
  });

  test('runs the packed MCP proof in CI on Linux, macOS, and Windows', () => {
    const workflow = readText('.github/workflows/ci.yml');

    expect(workflow).toContain('npm run test:mcp:packed');
    expect(workflow).toContain('macos-latest');
    expect(workflow).toContain('windows-latest');
  });

  test('keeps a version-guarded post-publish proof workflow', () => {
    const workflow = readText('.github/workflows/prove-mcp-published.yml');

    expect(workflow).toContain('EXPECTED_MCP_VERSION');
    expect(workflow).toContain('npm run proof:mcp:published');
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
