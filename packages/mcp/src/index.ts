/**
 * @buzzr/mcp — MCP server exposing the @buzzr sports engines to AI agents.
 *
 * Run `npx @buzzr/mcp` (bin: buzzr-mcp) for a stdio server, or import
 * `createBuzzrMcpServer` to embed the tool catalog in your own server.
 */

export {
  allTools,
  createBuzzrMcpServer,
  registerBuzzrTool,
  SERVER_NAME,
  SERVER_VERSION,
} from './server';

export {
  dfsTools,
  gradeDfsEntryTool,
  listBookPoliciesTool,
  validateDfsEntryTool,
} from './tools/dfs';
export { fairLineTool, kellyStakeTool, oddsTools, parlayValueTool } from './tools/odds';
export {
  buzzTools,
  createPredictGameBuzzTool,
  createRankGamesTool,
  predictGameBuzzTool,
  rankGamesTool,
} from './tools/buzz';
export type { EntertainmentEngineModule } from './tools/buzz';

export { defineTool, errorResult, jsonResult } from './tools/shared';
export type { BuzzrToolDefinition, ToolResult, ToolTextContent } from './tools/shared';
