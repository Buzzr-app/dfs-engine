import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const packageManifest = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};
const serverSource = readFileSync(resolve(here, '../src/server.ts'), 'utf8');
const cliSource = readFileSync(resolve(here, '../src/cli.ts'), 'utf8');
const publishedProof = readFileSync(
  resolve(here, '../../../scripts/prove-mcp-published.mjs'),
  'utf8',
);

describe('release safety contracts', () => {
  it('derives the advertised server version from the package manifest', () => {
    expect(serverSource).toContain("from '../package.json'");
    expect(serverSource).not.toMatch(/SERVER_VERSION\s*=\s*['"`]\d/);
  });

  it('does not interpolate startup exception details into public stderr', () => {
    expect(cliSource).not.toContain('error instanceof Error ? error.message');
    expect(cliSource).not.toContain('String(error)');
  });

  it('pins all internal Buzzr runtime dependencies exactly', () => {
    expect(packageManifest.dependencies).toMatchObject({
      '@buzzr/bets-core': '5.0.0',
      '@buzzr/dfs-engine': '5.0.0',
      '@buzzr/entertainment-engine': '5.0.0',
    });
  });

  it('runs the published npx proof through Node and the npm-provided npx CLI', () => {
    expect(publishedProof).toContain('process.env.npm_execpath');
    expect(publishedProof).toContain("'npx-cli.js'");
    expect(publishedProof).not.toContain("process.platform === 'win32' ? 'npx.cmd' : 'npx'");
  });

  it('proves all eleven public tools, including every new vNext contract', () => {
    for (const toolName of [
      'grade_dfs_entry',
      'grade_dfs_entries',
      'validate_dfs_entry',
      'list_book_policies',
      'fair_line',
      'closing_line_value',
      'parlay_value',
      'kelly_stake',
      'summarize_bet_history',
      'predict_game_buzz',
      'rank_games',
    ]) {
      expect(publishedProof).toContain(`'${toolName}'`);
    }
    expect(publishedProof).toContain('Published MCP DFS batch call');
    expect(publishedProof).toContain('Published MCP closing line call');
    expect(publishedProof).toContain('Published MCP bet history call');
  });

  it('binds the live npm proof to reviewed integrity, git head, provenance, and registry origin', () => {
    expect(publishedProof).toContain('EXPECTED_MCP_INTEGRITY');
    expect(publishedProof).toContain('EXPECTED_GIT_HEAD');
    expect(publishedProof).toContain("'dist.attestations.provenance'");
    expect(publishedProof).toContain("'dist.tarball'");
    expect(publishedProof).toContain("'gitHead'");
    expect(publishedProof).toContain("'https://registry.npmjs.org'");
    expect(publishedProof).toContain('assert.equal(integrity, expectedIntegrity');
    expect(publishedProof).toContain('assert.equal(gitHead, expectedGitHead');
  });

  it('runs npm and npx with isolated home, app-data, temp, registry, and config paths', () => {
    for (const variable of [
      'HOME',
      'USERPROFILE',
      'APPDATA',
      'LOCALAPPDATA',
      'TEMP',
      'TMP',
      'TMPDIR',
      'npm_config_userconfig',
      'npm_config_globalconfig',
      'npm_config_registry',
      'npm_config_ignore_scripts',
    ]) {
      expect(publishedProof).toContain(`${variable}:`);
    }
    expect(publishedProof).toContain("npm_config_registry: 'https://registry.npmjs.org/'");
    expect(publishedProof).toContain("npm_config_ignore_scripts: 'true'");
    expect(publishedProof).not.toMatch(/const inheritedEnvironmentKeys = \[[\s\S]*?'HOME'/);
  });
});
