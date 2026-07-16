import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFile(`${root}${path}`, 'utf8');

const [readme, skill, toolReference, packageManifestText] = await Promise.all([
  read('packages/mcp/README.md'),
  read('skills/buzzr-sports-engine/SKILL.md'),
  read('skills/buzzr-sports-engine/references/mcp-tools.md'),
  read('package.json'),
]);
const packageManifest = JSON.parse(packageManifestText);

function requirePattern(text, pattern, message) {
  assert.match(text, pattern, message);
}

const clientContracts = [
  [
    'Smithery',
    /### Smithery/,
    /npx -y smithery@1\.2\.0 mcp add sarveshsea\/buzzr-sports-engine --client codex/,
  ],
  ['Claude Desktop', /### Claude Desktop/, /claude_desktop_config\.json/],
  [
    'Claude Code',
    /### Claude Code/,
    /claude mcp add --transport stdio buzzr -- npx -y @buzzr\/mcp@5\.1\.0/,
  ],
  ['Cursor', /### Cursor/, /\.cursor\/mcp\.json/],
  ['Codex', /### Codex/, /\[mcp_servers\.buzzr\]/],
  ['generic stdio MCP client', /### Generic stdio MCP client/i, /"transport": "stdio"/],
];

for (const [client, heading, setup] of clientContracts) {
  requirePattern(readme, heading, `@buzzr/mcp README must have a separate ${client} setup section`);
  requirePattern(readme, setup, `@buzzr/mcp README must provide copy-paste ${client} setup`);
}

requirePattern(readme, /local stdio MCPB/i, 'README must identify Smithery as local stdio');
requirePattern(
  readme,
  /not a hosted HTTP service/i,
  'README must not describe the Smithery distribution as a hosted MCP service',
);

for (const discoveryTerm of [
  /`initialize`/,
  /`serverInfo\.name`/,
  /`serverInfo\.version`/,
  /`capabilities\.tools`/,
  /`notifications\/initialized`/,
  /`tools\/list`/,
]) {
  requirePattern(readme, discoveryTerm, 'README must document MCP initialization and discovery');
}

requirePattern(
  readme,
  /packages\/mcp\/examples\/mcp-calls\.json|examples\/mcp-calls\.json/,
  'README must link the machine-readable MCP call examples',
);
requirePattern(readme, /1[–-]50 entries/i, 'README must state the 50-entry batch limit');
requirePattern(readme, /600 total legs/i, 'README must state the 600-leg aggregate limit');

for (const troubleshootingTerm of [
  /Node(?:\.js)? 22\+/i,
  /npm cache/i,
  /PATH/,
  /Windows/i,
  /macOS/i,
  /Linux/i,
  /restart[^\n]*(?:client|Claude|Cursor|Codex)/i,
]) {
  requirePattern(
    readme,
    troubleshootingTerm,
    'README must cover Node, npx cache, PATH, platform, and restart troubleshooting',
  );
}

const toolNames = [
  'grade_dfs_entry',
  'grade_dfs_entries',
  'validate_dfs_entry',
  'list_book_policies',
  'fair_line',
  'closing_line_value',
  'parlay_value',
  'kelly_stake',
  'summarize_bet_history',
  'predict_game_buzz',
  'rank_games',
];
for (const toolName of toolNames) {
  requirePattern(readme, new RegExp(`\\\`${toolName}\\\``), `README must list ${toolName}`);
}

requirePattern(skill, /2[–-]50 entries/i, 'SKILL.md must state the 50-entry batch limit');
requirePattern(skill, /600 total legs/i, 'SKILL.md must state the 600-leg aggregate limit');
requirePattern(
  toolReference,
  /1[–-]50 entries/i,
  'The MCP tool reference must state the 50-entry batch limit',
);
requirePattern(
  toolReference,
  /600 total legs/i,
  'The MCP tool reference must state the 600-leg aggregate limit',
);

assert.equal(
  packageManifest.devDependencies?.skills,
  '1.5.17',
  'The one-command local skill installer must be pinned exactly to skills@1.5.17.',
);
assert.equal(
  packageManifest.scripts?.['check:mcp:examples'],
  'node scripts/validate-mcp-examples.mjs',
  'package.json must expose the MCP examples validator',
);
assert.equal(
  packageManifest.scripts?.['check:skill'],
  'node scripts/validate-buzzr-skill.mjs',
  'package.json must expose the repository skill validator',
);
for (const requiredCheck of [
  'npm run check:mcp:client-skill',
  'npm run check:mcp:examples',
  'npm run check:skill',
]) {
  assert.ok(
    packageManifest.scripts?.verify?.includes(requiredCheck),
    `verify must run ${requiredCheck}`,
  );
}

for (const path of [
  'packages/mcp/examples/mcp-calls.json',
  'scripts/validate-mcp-examples.mjs',
  'scripts/validate-buzzr-skill.mjs',
  'scripts/vendor/openai-skill-creator/quick_validate.py',
]) {
  await access(`${root}${path}`);
}

const examples = JSON.parse(await read('packages/mcp/examples/mcp-calls.json'));
assert.equal(examples.schemaVersion, '1');
assert.equal(examples.transport, 'stdio');
assert.equal(examples.discovery?.initialize?.request?.method, 'initialize');
assert.equal(examples.discovery?.initialized?.method, 'notifications/initialized');
assert.equal(examples.discovery?.toolsList?.request?.method, 'tools/list');
assert.deepEqual(examples.discovery?.toolsList?.expect?.toolNames, toolNames);

const workflowNames = examples.workflows?.[0]?.calls?.map((call) => call.request?.params?.name);
assert.deepEqual(
  workflowNames,
  ['list_book_policies', 'validate_dfs_entry', 'grade_dfs_entry'],
  'The machine-readable workflow must follow the skill safety order.',
);

process.stdout.write(
  'MCP client setup, discovery, examples, limits, troubleshooting, and repository skill contracts are complete.\n',
);
