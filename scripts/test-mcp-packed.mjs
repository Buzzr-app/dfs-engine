import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

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
  'validate_dfs_entry',
  'list_book_policies',
  'fair_line',
  'parlay_value',
  'kelly_stake',
  'predict_game_buzz',
  'rank_games',
];

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
  const { stdout } = await execFileAsync(
    'npm',
    ['pack', '--workspace', workspace, '--json', '--pack-destination', destination],
    { cwd: root, env: commandEnvironment(cache), maxBuffer: 10 * 1024 * 1024 },
  );
  const results = JSON.parse(stdout);
  assert.equal(results.length, 1, `Expected one packed artifact for ${workspace}`);
  return results[0];
}

function parseToolResult(result) {
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, 'text');
  return JSON.parse(result.content[0].text);
}

async function exerciseRealClient(consumerDirectory, cache, expectedVersion) {
  const transport = new StdioClientTransport({
    command: 'npm',
    args: ['exec', '--offline', '--', 'mcp'],
    cwd: consumerDirectory,
    env: commandEnvironment(cache),
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const client = new Client({ name: 'buzzr-packed-artifact-test', version: '1.0.0' });
  await client.connect(transport);
  try {
    assert.deepEqual(client.getServerVersion(), { name: 'buzzr', version: expectedVersion });

    const listed = await client.listTools();
    const listedNames = new Set(listed.tools.map((tool) => tool.name));
    for (const toolName of coreToolNames) {
      assert(listedNames.has(toolName), `Packed MCP is missing ${toolName}`);
    }

    const dfs = parseToolResult(
      await client.callTool({
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
    );
    assert.equal(dfs.status, 'won');
    assert.equal(dfs.payout.total, 30);

    const odds = parseToolResult(
      await client.callTool({
        name: 'fair_line',
        arguments: { selected: -110, opposite: -110 },
      }),
    );
    assert.equal(odds.fairProbability, 0.5);

    const entertainment = parseToolResult(
      await client.callTool({
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
    );
    assert.equal(typeof entertainment.score, 'number');

    const invalid = await client.callTool({
      name: 'fair_line',
      arguments: { selected: 0, opposite: -110 },
    });
    assert.equal(invalid.isError, true);
    assert.equal(invalid.content.length, 1);
    assert.equal(invalid.content[0].type, 'text');
    assert.match(invalid.content[0].text, /^MCP error -32602: Input validation error:/);

    const concurrent = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        client.callTool({
          name: 'fair_line',
          arguments: { selected: -110 - index, opposite: -110 },
        }),
      ),
    );
    assert(concurrent.every((result) => result.isError !== true));

    return { toolCount: listed.tools.length, stderr: () => stderr };
  } finally {
    await client.close();
    assert.equal(transport.pid, null, 'Packed MCP child process did not shut down');
  }
}

async function exerciseMalformedInput(consumerDirectory, cache, cliPath) {
  const child = spawn(process.execPath, [cliPath], {
    cwd: consumerDirectory,
    env: commandEnvironment(cache),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
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

  child.stdin.write('not-json\n');
  child.stdin.end(
    `${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'buzzr-malformed-input-test', version: '1.0.0' },
      },
    })}\n`,
  );

  const exit = await closed;
  assert.deepEqual(exit, { code: 0, signal: null });

  const lines = stdout.trim().split('\n').filter(Boolean);
  assert.equal(lines.length, 1, `Expected one JSON-RPC response, received: ${stdout}`);
  const response = JSON.parse(lines[0]);
  assert.equal(response.id, 1);
  assert.equal(response.result.serverInfo.name, 'buzzr');
  assert.match(stderr, /buzzr MCP server v\S+ listening on stdio/);
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
  assert.notEqual(cliFile.mode & 0o111, 0, 'Packed MCP CLI is not executable');

  const tarballs = packed.map((artifact) => join(packsDirectory, artifact.filename));
  await execFileAsync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs],
    {
      cwd: consumerDirectory,
      env: commandEnvironment(cache),
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  const installedPackagePath = join(consumerDirectory, 'node_modules', '@buzzr', 'mcp');
  const installedManifest = JSON.parse(
    await readFile(join(installedPackagePath, 'package.json'), 'utf8'),
  );
  assert.equal(installedManifest.bin.mcp, './dist/cli.js');
  assert.equal(installedManifest.bin['buzzr-mcp'], './dist/cli.js');

  const executableSuffix = process.platform === 'win32' ? '.cmd' : '';
  await access(join(consumerDirectory, 'node_modules', '.bin', `mcp${executableSuffix}`));
  await access(join(consumerDirectory, 'node_modules', '.bin', `buzzr-mcp${executableSuffix}`));

  const protocol = await exerciseRealClient(
    consumerDirectory,
    cache,
    installedManifest.version,
  );
  assert.match(protocol.stderr(), /buzzr MCP server v\S+ listening on stdio/);
  await exerciseMalformedInput(
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
