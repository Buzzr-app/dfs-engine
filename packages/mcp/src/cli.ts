import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createBuzzrMcpServer, SERVER_NAME, SERVER_VERSION } from './server';
import { BoundedNewlineInput } from './stdin-frame-limiter';

const INPUT_REJECTED_MESSAGE = 'buzzr-mcp rejected oversized input.\n';
const STARTUP_FAILED_MESSAGE = 'buzzr-mcp failed to start.\n';

async function main(): Promise<void> {
  const server = createBuzzrMcpServer();
  const boundedInput = new BoundedNewlineInput();
  process.stdin.pipe(boundedInput);
  boundedInput.once('error', () => {
    process.stdin.unpipe(boundedInput);
    process.stderr.write(INPUT_REJECTED_MESSAGE);
    process.exitCode = 1;
    void server.close().catch(() => undefined);
  });

  const transport = new StdioServerTransport(boundedInput);
  await server.connect(transport);
  // stdout is the MCP protocol channel; human-facing logs go to stderr.
  process.stderr.write(`${SERVER_NAME} MCP server v${SERVER_VERSION} listening on stdio\n`);
}

main().catch(() => {
  process.stderr.write(STARTUP_FAILED_MESSAGE);
  process.exit(1);
});
