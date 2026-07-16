const MCPB_SCHEMA =
  'https://raw.githubusercontent.com/modelcontextprotocol/mcpb/main/schemas/mcpb-manifest-v0.4.schema.json';
const SEMANTIC_VERSION =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const TOOL_NAME = /^[a-z][a-z0-9_]{0,63}$/;

export const SMITHERY_QUALIFIED_NAME = 'sarveshsea/buzzr-sports-engine';
export const SMITHERY_BUNDLE_NAME = 'buzzr-sports-engine';

function requireSemanticVersion(version) {
  if (typeof version !== 'string' || !SEMANTIC_VERSION.test(version)) {
    throw new TypeError('Smithery bundle version must be an exact semantic version.');
  }
  return version;
}

function copyTools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) {
    throw new TypeError('Smithery bundle tools must be a non-empty array.');
  }

  const copied = tools.map((tool) => {
    if (!tool || typeof tool !== 'object' || !TOOL_NAME.test(tool.name)) {
      throw new TypeError('Every Smithery tool name must be a safe MCP identifier.');
    }
    if (
      typeof tool.description !== 'string' ||
      tool.description.length === 0 ||
      tool.description.length > 2_000
    ) {
      throw new TypeError('Every Smithery tool description must contain 1 to 2,000 characters.');
    }
    return { name: tool.name, description: tool.description };
  });

  if (new Set(copied.map(({ name }) => name)).size !== copied.length) {
    throw new TypeError('Smithery tool names must be unique.');
  }
  return copied;
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

export function createSmitheryManifest({ version, tools }) {
  const exactVersion = requireSemanticVersion(version);
  const copiedTools = copyTools(tools);

  return deepFreeze({
    $schema: MCPB_SCHEMA,
    manifest_version: '0.4',
    name: SMITHERY_BUNDLE_NAME,
    display_name: 'Buzzr Sports Engine',
    version: exactVersion,
    description: 'Local sports math, DFS settlement, bet analytics, and game-entertainment tools.',
    long_description:
      'Deterministic, auditable sports computation through 11 MCP tools. Buzzr does not fetch live lines, access operator accounts, or require credentials.',
    author: {
      name: 'Sarvesh Chidambaram',
      url: 'https://github.com/Buzzr-app',
    },
    repository: {
      type: 'git',
      url: 'https://github.com/Buzzr-app/dfs-engine',
    },
    homepage: 'https://buzzr-app.github.io/dfs-engine/',
    documentation: 'https://github.com/Buzzr-app/dfs-engine/tree/main/packages/mcp',
    support: 'https://github.com/Buzzr-app/dfs-engine/issues',
    license: 'MIT',
    keywords: ['sports', 'dfs', 'odds', 'betting-math', 'model-context-protocol', 'buzzr'],
    server: {
      type: 'node',
      entry_point: 'server/index.js',
      mcp_config: {
        command: 'node',
        args: ['${__dirname}/server/index.js'],
        env: {},
      },
    },
    tools: copiedTools,
    tools_generated: false,
    prompts_generated: false,
    compatibility: {
      platforms: ['darwin', 'win32', 'linux'],
      runtimes: { node: '>=22' },
    },
  });
}

export function smitheryBundleFilename(version) {
  return `${SMITHERY_BUNDLE_NAME}-${requireSemanticVersion(version)}.mcpb`;
}
