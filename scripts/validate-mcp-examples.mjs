import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import {
  SERVER_NAME,
  SERVER_VERSION,
  allTools,
  createBuzzrMcpServer,
} from '../packages/mcp/dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const examples = JSON.parse(await readFile(`${root}packages/mcp/examples/mcp-calls.json`, 'utf8'));
const packageManifest = JSON.parse(await readFile(`${root}packages/mcp/package.json`, 'utf8'));
const skill = await readFile(`${root}skills/buzzr-sports-engine/SKILL.md`, 'utf8');

function pathValue(value, path) {
  return path.split('.').reduce((current, segment) => current?.[segment], value);
}

function assertExpected(actual, expected, context) {
  for (const [path, value] of Object.entries(expected)) {
    assert.deepEqual(pathValue(actual, path), value, `${context} did not match ${path}`);
  }
}

function parseToolResult(result, toolName) {
  assert.equal(result.isError, undefined, `${toolName} returned an MCP tool error`);
  assert.equal(result.content?.length, 1, `${toolName} must return one content item`);
  assert.equal(result.content[0]?.type, 'text', `${toolName} must return text content`);
  return JSON.parse(result.content[0].text);
}

assert.equal(examples.schemaVersion, '1');
assert.equal(examples.transport, 'stdio');
assert.equal(examples.discovery.initialize.request.method, 'initialize');
assert.equal(examples.discovery.initialized.method, 'notifications/initialized');
assert.equal(examples.discovery.toolsList.request.method, 'tools/list');
assert.equal(examples.discovery.initialize.expect.serverInfo.version, '$PACKAGE_VERSION');
assert.equal(SERVER_VERSION, packageManifest.version);

const expectedToolNames = examples.discovery.toolsList.expect.toolNames;
assert.deepEqual(
  allTools.map((tool) => tool.name),
  expectedToolNames,
);

const workflow = examples.workflows.find(({ id }) => id === 'safe-single-entry-settlement');
assert.ok(workflow, 'The safe single-entry settlement example is required.');
const workflowToolNames = workflow.calls.map((call) => call.request.params.name);
assert.deepEqual(workflowToolNames, [
  'list_book_policies',
  'validate_dfs_entry',
  'grade_dfs_entry',
]);

let previousSkillIndex = -1;
for (const toolName of workflowToolNames) {
  const index = skill.indexOf(`\`${toolName}\``, previousSkillIndex + 1);
  assert(index > previousSkillIndex, `SKILL.md must route ${toolName} in safe workflow order.`);
  previousSkillIndex = index;
}

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 'buzzr-example-validator', version: '1.0.0' });
const server = createBuzzrMcpServer();

try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  assert.deepEqual(client.getServerVersion(), {
    name: examples.discovery.initialize.expect.serverInfo.name,
    version: SERVER_VERSION,
  });
  assert.deepEqual(
    client.getServerCapabilities()?.tools,
    examples.discovery.initialize.expect.capabilities.tools,
  );

  const listed = await client.listTools();
  assert.deepEqual(
    listed.tools.map((tool) => tool.name),
    expectedToolNames,
  );
  for (const tool of listed.tools) {
    assert.equal(tool.inputSchema.type, 'object', `${tool.name} must advertise an object schema`);
  }

  for (const call of workflow.calls) {
    assert.equal(call.request.jsonrpc, '2.0');
    assert.equal(call.request.method, 'tools/call');
    const { name, arguments: args } = call.request.params;
    const result = parseToolResult(await client.callTool({ name, arguments: args }), name);
    assertExpected(result, call.expect, name);
  }
} finally {
  await client.close();
  await server.close();
}

process.stdout.write(
  `${SERVER_NAME} MCP examples passed real initialization, ${expectedToolNames.length}-tool discovery, and the skill-guided settlement workflow.\n`,
);
