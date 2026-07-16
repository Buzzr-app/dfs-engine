import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import packageManifest from '../package.json' with { type: 'json' };

import { buzzTools } from './tools/buzz';
import { dfsTools } from './tools/dfs';
import { historyTools } from './tools/history';
import { oddsTools } from './tools/odds';
import { errorResult } from './tools/shared';
import type { BuzzrToolDefinition } from './tools/shared';

export const SERVER_NAME = 'buzzr';
export const SERVER_VERSION = packageManifest.version;

/** Every tool this server ships, in catalog order. */
export const allTools: readonly BuzzrToolDefinition[] = [
  ...dfsTools,
  ...oddsTools,
  ...historyTools,
  ...buzzTools,
];

const registeredToolsByServer = new WeakMap<McpServer, Map<string, BuzzrToolDefinition>>();

function mcpInputSchema(tool: BuzzrToolDefinition) {
  const schema = z.toJSONSchema(tool.inputSchema, {
    target: 'draft-7',
    // boundedArray uses a size-only input stage and a fully described output
    // stage; advertise the latter while the handler still parses both.
    io: 'output',
  });
  if (schema.type !== 'object') {
    throw new TypeError(`Tool ${tool.name} must expose an object input schema.`);
  }
  return schema as { type: 'object'; [key: string]: unknown };
}

function installBoundedToolHandlers(
  server: McpServer,
  registeredTools: Map<string, BuzzrToolDefinition>,
): void {
  server.server.registerCapabilities({ tools: { listChanged: true } });
  server.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [...registeredTools.values()].map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: mcpInputSchema(tool),
    })),
  }));
  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = registeredTools.get(request.params.name);
    if (!tool) {
      return errorResult('tool_not_found', 'Requested tool was not found.');
    }
    return tool.handler(request.params.arguments);
  });
}

/**
 * Registers one @buzzr tool definition without delegating validation to the
 * SDK. Tool handlers own bounded validation so adversarial Zod issue lists can
 * never bypass the public result-size cap.
 */
export function registerBuzzrTool(server: McpServer, tool: BuzzrToolDefinition): void {
  let registeredTools = registeredToolsByServer.get(server);
  if (!registeredTools) {
    registeredTools = new Map();
    registeredToolsByServer.set(server, registeredTools);
    installBoundedToolHandlers(server, registeredTools);
  }
  if (registeredTools.has(tool.name)) {
    throw new TypeError(`Tool ${tool.name} is already registered.`);
  }
  registeredTools.set(tool.name, tool);
  if (server.isConnected()) {
    server.sendToolListChanged();
  }
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
