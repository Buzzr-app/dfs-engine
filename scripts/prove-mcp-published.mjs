import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { parseNpmViewValue } from './lib/npm-view-output.mjs';

const execFileAsync = promisify(execFile);
const expectedVersion = process.env.EXPECTED_MCP_VERSION?.trim();
const expectedIntegrity = process.env.EXPECTED_MCP_INTEGRITY?.trim();
const expectedGitHead = process.env.EXPECTED_GIT_HEAD?.trim();
assert(expectedVersion, 'EXPECTED_MCP_VERSION is required');
assert.match(
  expectedVersion,
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/,
  'EXPECTED_MCP_VERSION must be an exact semantic version',
);
assert(expectedIntegrity, 'EXPECTED_MCP_INTEGRITY is required');
assert.match(
  expectedIntegrity,
  /^sha512-[A-Za-z0-9+/=]+$/,
  'EXPECTED_MCP_INTEGRITY must be an exact sha512 npm integrity',
);
assert(expectedGitHead, 'EXPECTED_GIT_HEAD is required');
assert.match(expectedGitHead, /^[0-9a-f]{40}$/i, 'EXPECTED_GIT_HEAD must be a 40-character SHA');
const packageSpec = `@buzzr/mcp@${expectedVersion}`;
const npmExecPath = process.env.npm_execpath;
assert(npmExecPath, 'Run the published proof through npm so npm_execpath is available');
const npxCliPath = resolve(dirname(npmExecPath), 'npx-cli.js');

const coreToolNames = [
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
];

function execNpm(args, options) {
  return execFileAsync(process.execPath, [npmExecPath, ...args], options);
}

function parseToolResult(result) {
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, 'text');
  return JSON.parse(result.content[0].text);
}

async function withDeadline(promise, label, timeoutMs = 30_000) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'buzzr-mcp-published-'));
const cache = join(temporaryRoot, 'npm-cache');
const isolatedHome = join(temporaryRoot, 'home');
const isolatedAppData = join(temporaryRoot, 'appdata');
const isolatedLocalAppData = join(temporaryRoot, 'local-appdata');
const isolatedTemp = join(temporaryRoot, 'tmp');
const emptyUserConfig = join(temporaryRoot, 'empty-user.npmrc');
const emptyGlobalConfig = join(temporaryRoot, 'empty-global.npmrc');
const repositoryBin = resolve('node_modules', '.bin');
const path = (process.env.PATH ?? '')
  .split(delimiter)
  .filter((entry) => resolve(entry) !== repositoryBin)
  .join(delimiter);
const inheritedEnvironmentKeys = ['COMSPEC', 'LANG', 'LC_ALL', 'PATHEXT', 'SHELL', 'SYSTEMROOT'];
const environment = Object.fromEntries(
  inheritedEnvironmentKeys.flatMap((key) =>
    process.env[key] === undefined ? [] : [[key, process.env[key]]],
  ),
);
Object.assign(environment, {
  APPDATA: isolatedAppData,
  HOME: isolatedHome,
  LOCALAPPDATA: isolatedLocalAppData,
  NO_COLOR: '1',
  PATH: path,
  TEMP: isolatedTemp,
  TMP: isolatedTemp,
  TMPDIR: isolatedTemp,
  USERPROFILE: isolatedHome,
  npm_config_cache: cache,
  npm_config_userconfig: emptyUserConfig,
  npm_config_globalconfig: emptyGlobalConfig,
  npm_config_registry: 'https://registry.npmjs.org/',
  npm_config_ignore_scripts: 'true',
  npm_config_audit: 'false',
  npm_config_fund: 'false',
  npm_config_update_notifier: 'false',
});

try {
  await Promise.all(
    [cache, isolatedHome, isolatedAppData, isolatedLocalAppData, isolatedTemp].map((directory) =>
      mkdir(directory, { recursive: true }),
    ),
  );
  await Promise.all([writeFile(emptyUserConfig, ''), writeFile(emptyGlobalConfig, '')]);
  const { stdout: latestOutput } = await execNpm(
    ['view', '@buzzr/mcp', 'dist-tags.latest', '--json'],
    { cwd: temporaryRoot, env: environment },
  );
  const latest = parseNpmViewValue(latestOutput, 'dist-tags.latest');
  assert.equal(
    latest,
    expectedVersion,
    `npm latest is ${latest}; expected ${expectedVersion}. Refusing to prove the wrong release.`,
  );

  const viewField = async (field) => {
    const { stdout } = await execNpm(['view', packageSpec, field, '--json'], {
      cwd: temporaryRoot,
      env: environment,
    });
    assert(stdout.trim(), `Published package has no ${field} metadata`);
    return parseNpmViewValue(stdout, field);
  };
  const [integrity, gitHead, tarball, provenance] = await Promise.all([
    viewField('dist.integrity'),
    viewField('gitHead'),
    viewField('dist.tarball'),
    viewField('dist.attestations.provenance'),
  ]);
  assert.equal(integrity, expectedIntegrity, 'Published integrity does not match reviewed release');
  assert.equal(gitHead, expectedGitHead, 'Published gitHead does not match reviewed release');
  assert.equal(
    new URL(tarball).origin,
    'https://registry.npmjs.org',
    'Published tarball is not hosted by the npm registry',
  );
  assert(provenance, 'Published package has no npm provenance attestation');

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [npxCliPath, '-y', packageSpec],
    cwd: temporaryRoot,
    env: environment,
    stderr: 'pipe',
  });
  let stderr = '';
  let stderrOverflow = false;
  transport.stderr?.on('data', (chunk) => {
    if (stderrOverflow) {
      return;
    }
    const next = stderr + chunk.toString();
    if (Buffer.byteLength(next) > 256 * 1024) {
      stderrOverflow = true;
      return;
    }
    stderr = next;
  });

  const client = new Client({ name: 'buzzr-published-proof', version: '1.0.0' });
  try {
    await withDeadline(client.connect(transport), 'Published MCP initialization');
    assert.deepEqual(client.getServerVersion(), { name: 'buzzr', version: expectedVersion });

    const listed = await withDeadline(client.listTools(), 'Published MCP tools/list');
    const listedNames = new Set(listed.tools.map((tool) => tool.name));
    coreToolNames.forEach((toolName) => {
      assert(listedNames.has(toolName), `Published MCP is missing ${toolName}`);
    });

    const dfs = parseToolResult(
      await withDeadline(
        client.callTool({
          name: 'grade_dfs_entry',
          arguments: {
            entryId: 'published-proof',
            bookId: 'prizepicks',
            playTypeId: 'power',
            stake: 10,
            displayedMultiplier: 3,
            legs: [
              {
                legId: 'leg-1',
                playerName: 'Player One',
                league: 'NBA',
                propType: 'points',
                line: 25.5,
                direction: 'over',
                actual: 31,
              },
              {
                legId: 'leg-2',
                playerName: 'Player Two',
                league: 'NBA',
                propType: 'points',
                line: 27.5,
                direction: 'over',
                actual: 33,
              },
            ],
          },
        }),
        'Published MCP DFS call',
      ),
    );
    assert.equal(dfs.status, 'won');
    assert.equal(dfs.payout.total, 30);

    const dfsBatch = parseToolResult(
      await withDeadline(
        client.callTool({
          name: 'grade_dfs_entries',
          arguments: {
            entries: [
              {
                entryId: 'published-batch-proof',
                bookId: 'prizepicks',
                playTypeId: 'power',
                stake: 10,
                displayedMultiplier: 3,
                legs: [
                  {
                    legId: 'leg-1',
                    playerName: 'Player One',
                    league: 'NBA',
                    propType: 'points',
                    line: 25.5,
                    direction: 'over',
                    actual: 31,
                  },
                  {
                    legId: 'leg-2',
                    playerName: 'Player Two',
                    league: 'NBA',
                    propType: 'points',
                    line: 27.5,
                    direction: 'over',
                    actual: 33,
                  },
                ],
              },
            ],
            concurrency: 1,
          },
        }),
        'Published MCP DFS batch call',
      ),
    );
    assert.equal(dfsBatch.contractVersion, '1');
    assert.equal(dfsBatch.summary.settled, 1);

    const odds = parseToolResult(
      await withDeadline(
        client.callTool({
          name: 'fair_line',
          arguments: { selected: -110, opposite: -110 },
        }),
        'Published MCP odds call',
      ),
    );
    assert.equal(odds.fairProbability, 0.5);

    const closingLine = parseToolResult(
      await withDeadline(
        client.callTool({
          name: 'closing_line_value',
          arguments: { placedAmericanOdds: 110, closingAmericanOdds: -105 },
        }),
        'Published MCP closing line call',
      ),
    );
    assert.deepEqual(closingLine, {
      contractVersion: '1',
      clvPercent: 3.6,
      beatClosingLine: true,
    });

    const betHistory = parseToolResult(
      await withDeadline(
        client.callTool({
          name: 'summarize_bet_history',
          arguments: {
            bets: [
              {
                id: 'published-bet',
                userId: 'published-user',
                sportsbookSlug: 'draftkings',
                kind: 'straight',
                status: 'won',
                stake: 10,
                payout: 25,
                placedAt: '2026-07-15T17:00:00.000Z',
                settledAt: '2026-07-15T18:00:00.000Z',
              },
            ],
            period: 'day',
          },
        }),
        'Published MCP bet history call',
      ),
    );
    assert.equal(betHistory.contractVersion, '1');
    assert.equal(betHistory.period, 'day');
    assert.equal(betHistory.overall.totalBets, 1);

    const entertainment = parseToolResult(
      await withDeadline(
        client.callTool({
          name: 'predict_game_buzz',
          arguments: {
            league: 'NBA',
            homeTeam: 'Lakers',
            awayTeam: 'Celtics',
            startsAt: '2030-07-17T19:30:00-04:00',
          },
        }),
        'Published MCP entertainment call',
      ),
    );
    assert.equal(typeof entertainment.score, 'number');

    const invalid = await withDeadline(
      client.callTool({
        name: 'fair_line',
        arguments: { selected: 0, opposite: -110 },
      }),
      'Published MCP invalid call',
    );
    assert.equal(invalid.isError, true);
    assert.equal(invalid.content[0].type, 'text');
    assert.equal(parseToolResult(invalid).error.code, 'invalid_input');

    const adversarialValidation = await withDeadline(
      client.callTool({
        name: 'summarize_bet_history',
        arguments: { bets: Array.from({ length: 5_000 }, () => ({})) },
      }),
      'Published MCP adversarial validation call',
    );
    assert.equal(adversarialValidation.isError, true);
    assert.equal(parseToolResult(adversarialValidation).error.code, 'invalid_input');
    assert.ok(
      Buffer.byteLength(JSON.stringify(adversarialValidation), 'utf8') < 65_536,
      'Published MCP validation error must stay below 64 KiB',
    );

    const concurrent = await withDeadline(
      Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          client.callTool({
            name: 'fair_line',
            arguments: {
              selected: -110 - index,
              opposite: -110,
              selectedSide: `published-${index}`,
            },
          }),
        ),
      ),
      'Published MCP concurrent calls',
    );
    concurrent.forEach((result, index) => {
      assert.equal(parseToolResult(result).selectedSide, `published-${index}`);
    });

    assert.equal(stderrOverflow, false, 'Published MCP stderr exceeded limit');
    assert.match(stderr, new RegExp(`buzzr MCP server v${expectedVersion} listening on stdio`));
    process.stdout.write(
      `Published @buzzr/mcp@${expectedVersion} passed exact clean-cache npx proof with ${listed.tools.length} tools\n`,
    );
  } finally {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
