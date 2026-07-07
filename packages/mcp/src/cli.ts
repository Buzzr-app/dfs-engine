import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createBuzzrMcpServer, SERVER_NAME, SERVER_VERSION } from './server';

async function main(): Promise<void> {
  const server = createBuzzrMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is the MCP protocol channel; human-facing logs go to stderr.
  process.stderr.write(`${SERVER_NAME} MCP server v${SERVER_VERSION} listening on stdio\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `buzzr-mcp failed to start: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
