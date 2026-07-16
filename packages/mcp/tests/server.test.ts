import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { allTools, createBuzzrMcpServer, SERVER_NAME, SERVER_VERSION } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const packageManifest = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8')) as {
  version: string;
};

const EXPECTED_TOOL_NAMES = [
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

describe('tool catalog', () => {
  it('advertises the package manifest version', () => {
    expect(SERVER_VERSION).toBe(packageManifest.version);
  });

  it('ships all eleven engine tools', () => {
    expect(allTools.map((tool) => tool.name)).toEqual(EXPECTED_TOOL_NAMES);
  });

  it('gives every tool a title, description, and schema', () => {
    for (const tool of allTools) {
      expect(tool.title.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.handler).toBe('function');
    }
  });
});

describe('createBuzzrMcpServer', () => {
  it('serves the catalog over an MCP transport', async () => {
    const server = createBuzzrMcpServer();
    const client = new Client({ name: 'buzzr-mcp-test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const serverVersion = client.getServerVersion();
      expect(serverVersion?.name).toBe(SERVER_NAME);
      expect(serverVersion?.version).toBe(SERVER_VERSION);

      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name).sort()).toEqual([...EXPECTED_TOOL_NAMES].sort());
      const fairLine = listed.tools.find((tool) => tool.name === 'fair_line');
      expect(fairLine?.inputSchema).toMatchObject({ type: 'object' });
      const batch = listed.tools.find((tool) => tool.name === 'grade_dfs_entries');
      expect(batch?.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          entries: {
            type: 'array',
            minItems: 1,
            maxItems: 25,
            items: {
              type: 'object',
              properties: {
                entryId: { type: 'string' },
                legs: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 12,
                  items: { type: 'object' },
                },
              },
            },
          },
        },
      });

      const callResult = await client.callTool({
        name: 'fair_line',
        arguments: { selected: -110, opposite: -110 },
      });
      const content = callResult.content as Array<{ type: string; text: string }>;
      expect(content[0].type).toBe('text');
      const fair = JSON.parse(content[0].text) as Record<string, unknown>;
      expect(fair.fairProbability).toBe(0.5);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('bounds transport-level validation errors before the SDK can amplify them', async () => {
    const server = createBuzzrMcpServer();
    const client = new Client({ name: 'buzzr-mcp-adversarial-test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const result = await client.callTool({
        name: 'summarize_bet_history',
        arguments: { bets: Array.from({ length: 5_000 }, () => ({})) },
      });
      const content = result.content as Array<{ type: string; text: string }>;

      expect(result.isError).toBe(true);
      expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThan(65_536);
      expect(JSON.parse(content[0].text)).toMatchObject({
        error: { code: 'invalid_input' },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
