const SEMANTIC_VERSION =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const SERVER_NAME = /^[a-z][a-z0-9_-]{2,63}$/;
const TOOL_NAME = /^[a-z][a-z0-9_]{0,63}$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
}

export function createSmitheryReleasePayload({ serverInfo, tools }) {
  if (!isObject(serverInfo) || !SERVER_NAME.test(serverInfo.name)) {
    throw new TypeError('Smithery release serverInfo must contain a safe server name.');
  }
  if (typeof serverInfo.version !== 'string' || !SEMANTIC_VERSION.test(serverInfo.version)) {
    throw new TypeError('Smithery release serverInfo must contain an exact semantic version.');
  }
  if (!Array.isArray(tools) || tools.length === 0) {
    throw new TypeError('Smithery release tools must be a non-empty array.');
  }

  const copiedTools = tools.map((tool) => {
    if (!isObject(tool) || !TOOL_NAME.test(tool.name)) {
      throw new TypeError('Every Smithery release tool must contain a safe name.');
    }
    if (typeof tool.description !== 'string' || tool.description.length === 0) {
      throw new TypeError('Every Smithery release tool must contain a description.');
    }
    if (!isObject(tool.inputSchema) || tool.inputSchema.type !== 'object') {
      throw new TypeError(`Smithery release tool ${tool.name} must contain an object inputSchema.`);
    }
    return structuredClone(tool);
  });
  if (new Set(copiedTools.map(({ name }) => name)).size !== copiedTools.length) {
    throw new TypeError('Smithery release tool names must be unique.');
  }

  return deepFreeze({
    type: 'stdio',
    runtime: 'node',
    serverCard: {
      serverInfo: { name: serverInfo.name, version: serverInfo.version },
      tools: copiedTools,
    },
  });
}
