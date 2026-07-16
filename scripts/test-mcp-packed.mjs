import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { JSONRPCMessageSchema, LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaces = [
  '@buzzr/bets-core',
  '@buzzr/dfs-engine',
  '@buzzr/entertainment-engine',
  '@buzzr/mcp',
];
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
const maxCapturedBytes = 256 * 1024;

function execNpm(args, options) {
  if (process.env.npm_execpath) {
    return execFileAsync(process.execPath, [process.env.npm_execpath, ...args], options);
  }
  return execFileAsync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, options);
}

function npmCommand(args) {
  if (process.env.npm_execpath) {
    return { command: process.execPath, args: [process.env.npm_execpath, ...args] };
  }
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args };
}

function captureOutput(capture, chunk, label) {
  if (capture.overflow) {
    return;
  }
  const next = capture.value + chunk.toString();
  if (Buffer.byteLength(next) > maxCapturedBytes) {
    capture.overflow = new Error(`${label} exceeded ${maxCapturedBytes} bytes`);
    return;
  }
  capture.value = next;
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

function commandEnvironment(cache) {
  return {
    ...process.env,
    NO_COLOR: '1',
    npm_config_cache: cache,
    npm_config_fund: 'false',
    npm_config_audit: 'false',
    npm_config_update_notifier: 'false',
  };
}

async function packWorkspace(workspace, destination, cache) {
  const { stdout } = await execNpm(
    ['pack', '--workspace', workspace, '--json', '--pack-destination', destination],
    { cwd: root, env: commandEnvironment(cache), maxBuffer: 10 * 1024 * 1024 },
  );
  const jsonStart = stdout.lastIndexOf('\n[');
  const results = JSON.parse(jsonStart === -1 ? stdout : stdout.slice(jsonStart + 1));
  assert.equal(results.length, 1, `Expected one packed artifact for ${workspace}`);
  return results[0];
}

function parseToolResult(result) {
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, 'text');
  return JSON.parse(result.content[0].text);
}

async function exerciseRealClient(consumerDirectory, cache, expectedVersion) {
  const npm = npmCommand(['exec', '--offline', '--', 'mcp']);
  const transport = new StdioClientTransport({
    command: npm.command,
    args: npm.args,
    cwd: consumerDirectory,
    env: commandEnvironment(cache),
    stderr: 'pipe',
  });
  const stderr = { value: '', overflow: null };
  transport.stderr?.on('data', (chunk) => {
    captureOutput(stderr, chunk, 'Packed MCP stderr');
  });

  const client = new Client({ name: 'buzzr-packed-artifact-test', version: '1.0.0' });
  try {
    await withDeadline(client.connect(transport), 'Packed MCP initialization');
    assert.deepEqual(client.getServerVersion(), { name: 'buzzr', version: expectedVersion });

    const listed = await withDeadline(client.listTools(), 'Packed MCP tools/list');
    const listedNames = new Set(listed.tools.map((tool) => tool.name));
    for (const toolName of coreToolNames) {
      assert(listedNames.has(toolName), `Packed MCP is missing ${toolName}`);
    }

    const dfs = parseToolResult(
      await withDeadline(
        client.callTool({
          name: 'grade_dfs_entry',
          arguments: {
            entryId: 'packed-proof',
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
        'Packed MCP DFS call',
      ),
    );
    assert.equal(dfs.status, 'won');
    assert.equal(dfs.payout.total, 30);
    assert.equal(dfs.validation.ok, true);
    assert(Array.isArray(dfs.auditTrail));
    assert.match(dfs.explanation, /packed-proof settled as won/);

    const dfsBatch = parseToolResult(
      await withDeadline(
        client.callTool({
          name: 'grade_dfs_entries',
          arguments: {
            entries: [
              {
                entryId: 'packed-batch-proof',
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
        'Packed MCP DFS batch call',
      ),
    );
    assert.equal(dfsBatch.contractVersion, '1');
    assert.equal(dfsBatch.summary.settled, 1);
    assert.equal(dfsBatch.results[0].entryId, 'packed-batch-proof');

    const odds = parseToolResult(
      await withDeadline(
        client.callTool({
          name: 'fair_line',
          arguments: { selected: -110, opposite: -110 },
        }),
        'Packed MCP odds call',
      ),
    );
    assert.equal(odds.fairProbability, 0.5);

    const closingLine = parseToolResult(
      await withDeadline(
        client.callTool({
          name: 'closing_line_value',
          arguments: { placedAmericanOdds: 110, closingAmericanOdds: -105 },
        }),
        'Packed MCP closing line call',
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
                id: 'packed-bet',
                userId: 'packed-user',
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
        'Packed MCP bet history call',
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
            odds: { spread: -1.5, overUnder: 228.5 },
            narratives: { isRivalry: true, rivalryIntensity: 3 },
          },
        }),
        'Packed MCP entertainment call',
      ),
    );
    assert.equal(typeof entertainment.score, 'number');

    const invalid = await withDeadline(
      client.callTool({
        name: 'fair_line',
        arguments: { selected: 0, opposite: -110 },
      }),
      'Packed MCP invalid call',
    );
    assert.equal(invalid.isError, true);
    assert.equal(invalid.content.length, 1);
    assert.equal(invalid.content[0].type, 'text');
    assert.equal(parseToolResult(invalid).error.code, 'invalid_input');

    const adversarialValidation = await withDeadline(
      client.callTool({
        name: 'summarize_bet_history',
        arguments: { bets: Array.from({ length: 5_000 }, () => ({})) },
      }),
      'Packed MCP adversarial validation call',
    );
    assert.equal(adversarialValidation.isError, true);
    assert.equal(parseToolResult(adversarialValidation).error.code, 'invalid_input');
    assert.ok(
      Buffer.byteLength(JSON.stringify(adversarialValidation), 'utf8') < 65_536,
      'Packed MCP validation error must stay below 64 KiB',
    );

    const concurrent = await withDeadline(
      Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          client.callTool({
            name: 'fair_line',
            arguments: {
              selected: -110 - index,
              opposite: -110,
              selectedSide: `call-${index}`,
            },
          }),
        ),
      ),
      'Packed MCP concurrent calls',
    );
    concurrent.forEach((result, index) => {
      assert.equal(result.isError, undefined);
      assert.equal(parseToolResult(result).selectedSide, `call-${index}`);
    });

    assert.equal(stderr.overflow, null);
    return { toolCount: listed.tools.length, stderr: () => stderr.value };
  } finally {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
}

async function exerciseMalformedInput(consumerDirectory, cache, cliPath) {
  const child = spawn(process.execPath, [cliPath], {
    cwd: consumerDirectory,
    env: commandEnvironment(cache),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stdout = { value: '', overflow: null };
  const stderr = { value: '', overflow: null };
  child.stdout.on('data', (chunk) => {
    captureOutput(stdout, chunk, 'Packed MCP stdout');
  });
  child.stderr.on('data', (chunk) => {
    captureOutput(stderr, chunk, 'Packed MCP stderr');
  });

  const closed = new Promise((resolveClose, rejectClose) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      rejectClose(new Error('Packed MCP did not shut down after stdin closed'));
    }, 5_000);
    child.once('error', rejectClose);
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      resolveClose({ code, signal });
    });
  });

  const initialize = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'buzzr-malformed-input-test', version: '1.0.0' },
    },
  });
  const initialized = JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {},
  });
  const listTools = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  });
  const splitAt = Math.floor(initialize.length / 2);

  child.stdin.write(
    `not-json\n${JSON.stringify({ jsonrpc: '2.0', id: 0, method: 42 })}\n${initialize.slice(0, splitAt)}`,
  );
  setImmediate(() => {
    child.stdin.end(`${initialize.slice(splitAt)}\r\n${initialized}\n${listTools}\n{"jsonrpc":`);
  });

  const exit = await closed;
  assert.deepEqual(exit, { code: 0, signal: null });
  assert.equal(stdout.overflow, null);
  assert.equal(stderr.overflow, null);

  assert(stdout.value.endsWith('\n'), 'Packed MCP stdout must end on a frame boundary');
  const lines = stdout.value.slice(0, -1).split('\n');
  assert.equal(lines.length, 2, `Expected two JSON-RPC responses, received: ${stdout.value}`);
  assert(
    lines.every((line) => line.length > 0),
    'Packed MCP stdout contained a blank frame',
  );
  const responses = lines.map((line) => JSONRPCMessageSchema.parse(JSON.parse(line)));
  assert.deepEqual(
    responses.map((response) => response.id),
    [1, 2],
  );
  assert.equal(responses[0].result.serverInfo.name, 'buzzr');
  assert(Array.isArray(responses[1].result.tools));
  assert.match(stderr.value, /buzzr MCP server v\S+ listening on stdio/);
}

async function exerciseOversizedInput(consumerDirectory, cache, cliPath) {
  const child = spawn(process.execPath, [cliPath], {
    cwd: consumerDirectory,
    env: commandEnvironment(cache),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stdout = { value: '', overflow: null };
  const stderr = { value: '', overflow: null };
  child.stdout.on('data', (chunk) => {
    captureOutput(stdout, chunk, 'Oversized-input MCP stdout');
  });
  child.stderr.on('data', (chunk) => {
    captureOutput(stderr, chunk, 'Oversized-input MCP stderr');
  });

  const closed = new Promise((resolveClose, rejectClose) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      rejectClose(new Error('Packed MCP did not reject oversized stdin'));
    }, 5_000);
    child.once('error', rejectClose);
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      resolveClose({ code, signal });
    });
  });

  // Keep the client side of stdin open after the oversized frame. The server
  // must reject and exit on its own instead of waiting forever for client EOF.
  child.stdin.write(Buffer.concat([Buffer.alloc(2 * 1_024 * 1_024 + 1, 0x78), Buffer.from('\n')]));

  const exit = await closed;
  assert.deepEqual(exit, { code: 1, signal: null });
  assert.equal(stdout.overflow, null);
  assert.equal(stderr.overflow, null);
  assert.equal(stdout.value, '');
  assert.match(stderr.value, /buzzr-mcp rejected oversized input\./);
  assert.doesNotMatch(stderr.value, /RangeError|ERR_|frame length|2 MiB/i);
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'buzzr-mcp-packed-'));
const packsDirectory = join(temporaryRoot, 'packs');
const consumerDirectory = join(temporaryRoot, 'consumer');
const cache = join(temporaryRoot, 'npm-cache');

try {
  await mkdir(packsDirectory, { recursive: true });
  await mkdir(consumerDirectory, { recursive: true });
  await writeFile(
    join(consumerDirectory, 'package.json'),
    `${JSON.stringify({ name: 'buzzr-mcp-packed-consumer', private: true }, null, 2)}\n`,
  );

  const packed = [];
  for (const workspace of workspaces) {
    packed.push(await packWorkspace(workspace, packsDirectory, cache));
  }
  const mcpPack = packed.find((artifact) => artifact.name === '@buzzr/mcp');
  assert(mcpPack, 'Missing packed @buzzr/mcp artifact');
  const cliFile = mcpPack.files.find((file) => file.path === 'dist/cli.js');
  assert(cliFile, 'Packed @buzzr/mcp is missing dist/cli.js');
  if (process.platform !== 'win32') {
    assert.notEqual(cliFile.mode & 0o111, 0, 'Packed MCP CLI is not executable');
  }

  const tarballs = packed.map((artifact) => join(packsDirectory, artifact.filename));
  await execNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs], {
    cwd: consumerDirectory,
    env: commandEnvironment(cache),
    maxBuffer: 20 * 1024 * 1024,
  });

  const installedPackagePath = join(consumerDirectory, 'node_modules', '@buzzr', 'mcp');
  const installedManifest = JSON.parse(
    await readFile(join(installedPackagePath, 'package.json'), 'utf8'),
  );
  assert.equal(installedManifest.scripts.prepack, 'npm run build');
  assert.equal(installedManifest.bin.mcp, './dist/cli.js');
  assert.equal(installedManifest.bin['buzzr-mcp'], './dist/cli.js');

  const executableSuffix = process.platform === 'win32' ? '.cmd' : '';
  const executableMode = process.platform === 'win32' ? undefined : fsConstants.X_OK;
  await access(
    join(consumerDirectory, 'node_modules', '.bin', `mcp${executableSuffix}`),
    executableMode,
  );
  await access(
    join(consumerDirectory, 'node_modules', '.bin', `buzzr-mcp${executableSuffix}`),
    executableMode,
  );

  const protocol = await exerciseRealClient(consumerDirectory, cache, installedManifest.version);
  assert.match(protocol.stderr(), /buzzr MCP server v\S+ listening on stdio/);
  await exerciseMalformedInput(
    consumerDirectory,
    cache,
    join(installedPackagePath, 'dist', 'cli.js'),
  );
  await exerciseOversizedInput(
    consumerDirectory,
    cache,
    join(installedPackagePath, 'dist', 'cli.js'),
  );

  process.stdout.write(
    `@buzzr/mcp packed artifact passed: ${protocol.toolCount} tools, real stdio client, schema rejection, concurrency, malformed-input recovery, stdout purity, and clean shutdown\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
