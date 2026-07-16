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

export function createSmitheryReleasePayload({ manifest, tools }) {
  if (!isObject(manifest) || !SERVER_NAME.test(manifest.name)) {
    throw new TypeError('Smithery release manifest must contain a safe server name.');
  }
  if (typeof manifest.version !== 'string' || !SEMANTIC_VERSION.test(manifest.version)) {
    throw new TypeError('Smithery release manifest must contain an exact semantic version.');
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
      serverInfo: { name: manifest.name, version: manifest.version },
      tools: copiedTools,
    },
  });
}
