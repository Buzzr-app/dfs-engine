import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

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

function transportInputSchema(tool: BuzzrToolDefinition) {
  const schema = z.toJSONSchema(tool.inputSchema, {
    target: 'draft-7',
    // boundedArray uses a size-only input stage and a fully described output
    // stage; advertise the latter while the handler still parses both.
    io: 'output',
  });
  if (schema.type !== 'object') {
    throw new TypeError(`Tool ${tool.name} must expose an object input schema.`);
  }
  const { $schema: _schemaDialect, ...discoveryMetadata } = schema;
  return z.object({}).passthrough().meta(discoveryMetadata);
}

/**
 * Registers one Buzzr tool through the SDK's native registry. The transport
 * schema accepts an argument object while advertising the full discovery
 * schema; the handler then owns bounded validation and error serialization.
 */
export function registerBuzzrTool(server: McpServer, tool: BuzzrToolDefinition): void {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: transportInputSchema(tool),
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
