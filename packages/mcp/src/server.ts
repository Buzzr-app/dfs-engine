import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import packageManifest from '../package.json' with { type: 'json' };

import { buzzTools } from './tools/buzz';
import { dfsTools } from './tools/dfs';
import { historyTools } from './tools/history';
import { oddsTools } from './tools/odds';
import type { BuzzrToolDefinition, ToolResult } from './tools/shared';

export const SERVER_NAME = 'buzzr';
export const SERVER_VERSION = packageManifest.version;

/** Every tool this server ships, in catalog order. */
export const allTools: readonly BuzzrToolDefinition[] = [
  ...dfsTools,
  ...oddsTools,
  ...historyTools,
  ...buzzTools,
];

/** Registers one @buzzr tool definition on an McpServer instance. */
export function registerBuzzrTool(server: McpServer, tool: BuzzrToolDefinition): void {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
    },
    (args: unknown): Promise<ToolResult> => tool.handler(args),
  );
}

/**
 * Creates the Buzzr MCP server with the full engine tool catalog registered.
 * Connect it to any transport (stdio via the buzzr-mcp bin, or in-memory /
 * HTTP transports when embedding).
 */
export function createBuzzrMcpServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  for (const tool of allTools) {
    registerBuzzrTool(server, tool);
  }
  return server;
}
