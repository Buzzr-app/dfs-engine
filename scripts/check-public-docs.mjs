import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

const files = {
  agents: 'AGENTS.md',
  root: 'README.md',
  llms: 'llms.txt',
  architecture: 'docs/architecture.md',
  security: 'docs/security-and-privacy.md',
  versioning: 'docs/versioning-and-support.md',
  apiIndex: 'docs/api-reference.md',
  engine: 'packages/dfs-engine/README.md',
  mcp: 'packages/mcp/README.md',
  cli: 'packages/dfs-cli/README.md',
  vectors: 'packages/dfs-engine-test-vectors/README.md',
  testkit: 'packages/dfs-testkit/README.md',
  vectorManifest: 'packages/dfs-engine-test-vectors/package.json',
  skill: 'skills/buzzr-sports-engine/SKILL.md',
  skillTools: 'skills/buzzr-sports-engine/references/mcp-tools.md',
  engineChangelog: 'packages/dfs-engine/CHANGELOG.md',
  mcpChangelog: 'packages/mcp/CHANGELOG.md',
  cliChangelog: 'packages/dfs-cli/CHANGELOG.md',
  vectorsChangelog: 'packages/dfs-engine-test-vectors/CHANGELOG.md',
  baseline: 'docs/launch/adoption-baseline-2026-07-16.md',
  checklist: 'docs/launch/launch-checklist.md',
  awesomeLists: 'docs/launch/awesome-lists.md',
  devto: 'docs/launch/devto-article.md',
  reddit: 'docs/launch/reddit.md',
  showHn: 'docs/launch/show-hn.md',
  twitter: 'docs/launch/twitter-thread.md',
};

const docs = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, path]) => [
      key,
      await readFile(`${root}${path}`, 'utf8').catch((error) => {
        if (error?.code === 'ENOENT') return '';
        throw error;
      }),
    ]),
  ),
);

const publicKeys = Object.keys(docs);
const publicText = publicKeys.map((key) => docs[key]).join('\n');

const staleClaims = [
  [/\b8 tools?\b/i, 'the retired eight-tool catalog'],
  [/book[- ]accurate/i, 'book-accurate operator behavior'],
  [
    /mirrors?\s+PrizePicks(?:\s*\/\s*|\s+and\s+)Underdog(?:\s+settlement)?\s+rules/i,
    'mirrored operator rules',
  ],
  [
    /PrizePicks and Underdog (?:ship as|are still) stable built-ins/i,
    'stable built-in operator profiles',
  ],
  [/baseline:\s*~?24 downloads\/week/i, 'the superseded 24-download baseline'],
  [/\|\s*~?24\s*\|/i, 'the superseded 24-download metric row'],
  [
    /grades identically to Buzzr(?:'s)? (?:production pipeline|grading)/i,
    'production-conformance vectors',
  ],
  [/prove(?:s)? your integration grades identically to Buzzr/i, 'production-conformance vectors'],
  [/passing conformance test/i, 'an overclaimed conformance test'],
  [
    /published (?:golden )?(?:test )?vectors? for conformance testing/i,
    'official-sounding conformance vectors',
  ],
  [/published conformance vectors/i, 'official-sounding conformance vectors'],
  [/Everything is pure functions: no I\/O/i, 'pure-function behavior for boundary packages'],
  [/No package may add a runtime dependency outside/i, 'a zero-dependency rule for every package'],
  [/Golden vectors are conformance law/i, 'regression vectors as conformance law'],
  [/all packages currently release in lockstep/i, 'an unverified lockstep-release rule'],
  [/JSON-RPC `-32602`/i, 'SDK-amplified tool argument errors'],
  [/1[–-]50 entries/i, 'the retired 50-entry MCP batch limit'],
  [/600 total legs/i, 'the retired 600-leg MCP batch limit'],
  [/grades identically to Buzzr/i, 'production-conformance vectors'],
  [/canonical reference fixtures/i, 'canonical operator fixtures'],
];

for (const [pattern, label] of staleClaims) {
  assert.doesNotMatch(publicText, pattern, `Public docs still claim ${label}.`);
}

function requireText(key, expected, reason) {
  assert.ok(
    docs[key].includes(expected),
    `${files[key]} must ${reason}; missing ${JSON.stringify(expected)}.`,
  );
}

function requirePattern(key, pattern, reason) {
  assert.match(docs[key], pattern, `${files[key]} must ${reason}.`);
}

for (const key of ['root', 'llms', 'mcp']) {
  requirePattern(key, /\b11 tools\b/i, 'state the current MCP tool count');
}
requirePattern('agents', /\b11 tools\b/i, 'state the current MCP tool count');

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
  requireText('mcp', `\`${toolName}\``, `list the ${toolName} tool`);
}

for (const key of ['root', 'engine', 'mcp', 'cli']) {
  requirePattern(
    key,
    /PrizePicks[^\n]*(?:experimental[^\n]*partial|partial[^\n]*experimental)/i,
    'label the PrizePicks profile experimental and partially verified',
  );
  requirePattern(
    key,
    /Underdog[^\n]*(?:experimental[^\n]*unverified|unverified[^\n]*experimental)/i,
    'label the Underdog profile experimental and unverified',
  );
  requirePattern(
    key,
    /displayed (?:lineup|entry|slip) terms? (?:are|remain|is) authoritative/i,
    'make the displayed terms authoritative',
  );
}

for (const key of ['engine', 'mcp']) {
  requireText(
    key,
    'https://www.prizepicks.com/help-center/payouts',
    'cite the reviewed PrizePicks payouts source',
  );
  requireText(
    key,
    'https://www.prizepicks.com/help-center/potential-outcomes',
    'cite the reviewed PrizePicks standard outcomes source',
  );
  requireText(key, 'https://legal.underdogsports.com/', 'cite the canonical Underdog legal source');
}

requirePattern('mcp', /executable:\s*false/i, 'explain that draft policies are non-executable');
requirePattern(
  'mcp',
  /(?:reject|cannot|never)[^\n]*draft/i,
  'explain that grading does not execute drafts',
);
requirePattern(
  'mcp',
  /(?:transport|MCP client)[\s\S]{0,180}`invalid_input`/i,
  'document bounded transport validation failures',
);
requirePattern('mcp', /1[–-]25 entries/i, 'state the current batch entry bound');
requirePattern('mcp', /300 total legs/i, 'state the current aggregate leg bound');

const mobileSnapshot =
  'The Buzzr mobile app’s `release/ios-2.0.0` branch vendors `@buzzr/bets-core`, `@buzzr/dfs-engine`, and `@buzzr/entertainment-engine` as local 5.0.0 tarballs and imports all three.';
requireText('root', mobileSnapshot, 'state the exact verified mobile integration snapshot');
requireText('llms', mobileSnapshot, 'carry the exact verified mobile integration snapshot');
for (const key of ['root', 'llms']) {
  requirePattern(
    key,
    /not automatically (?:updated|upgraded)[^\n]*vNext/i,
    'separate the app snapshot from vNext',
  );
  requireText(
    key,
    'skills/buzzr-sports-engine/SKILL.md',
    'link to the repository-owned Buzzr skill',
  );
  requireText(
    key,
    'npx skills add https://github.com/Buzzr-app/dfs-engine --skill buzzr-sports-engine',
    'show the Buzzr skill install command',
  );
  requireText(key, 'packages/mcp/README.md', 'link to MCP client configuration');
}

for (const key of ['root', 'llms', 'vectors']) {
  requirePattern(
    key,
    /engine regression fixtures/i,
    'describe test vectors as engine regression fixtures',
  );
  requirePattern(
    key,
    /not official operator conformance/i,
    'disclaim official operator conformance',
  );
}
requirePattern('testkit', /engine regression fixtures/i, 'route consumers to regression fixtures');
requirePattern(
  'testkit',
  /not official operator conformance/i,
  'disclaim official operator conformance',
);
requirePattern(
  'vectorManifest',
  /engine regression fixtures/i,
  'describe the package as engine regression fixtures',
);
for (const key of ['skill', 'skillTools']) {
  requirePattern(key, /2[–-]25 entries/i, 'state the current batch entry bound');
}
requirePattern('skillTools', /300 total legs/i, 'state the current aggregate leg bound');

requireText('baseline', '2026-07-09 through 2026-07-15', 'preserve the measured baseline window');
requirePattern(
  'baseline',
  /\b191\b[^\n]*package downloads/i,
  'preserve the measured family baseline',
);
requirePattern(
  'checklist',
  /baseline[^\n]*191[^\n]*2026-07-09[^\n]*2026-07-15/i,
  'use the measured launch baseline',
);

for (const key of ['checklist', 'awesomeLists', 'devto', 'reddit', 'showHn', 'twitter']) {
  requirePattern(
    key,
    /\b(?:draft|drafts|prepared text only)\b/i,
    'identify the material as a draft',
  );
  requirePattern(key, /\bmanual(?:ly)?\b/i, 'require manual publication');
}

for (const key of ['engineChangelog', 'mcpChangelog', 'cliChangelog', 'vectorsChangelog']) {
  requirePattern(
    key,
    /^## Unreleased \(vNext\)$/m,
    'record the unreleased documentation contract without guessing a version',
  );
}

for (const key of ['root', 'agents']) {
  requireText(key, 'docs/architecture.md', 'link the architecture and data-flow reference');
  requireText(key, 'docs/security-and-privacy.md', 'link the threat-model and privacy reference');
  requireText(key, 'docs/versioning-and-support.md', 'link the versioning and support policy');
  requireText(key, 'docs/api-reference.md', 'link the all-package API index');
}

requirePattern(
  'agents',
  /core engines[^\n]*zero external runtime dependencies/i,
  'scope the zero-dependency invariant to core engines',
);
requirePattern('agents', /MCP[^\n]*(?:SDK|Zod)/i, 'record the MCP runtime dependency exception');
requirePattern('agents', /engine regression fixtures/i, 'treat vectors as regression fixtures');
requirePattern(
  'agents',
  /not official operator conformance/i,
  'reject operator-conformance overclaims',
);
requireText('agents', 'node scripts/check-public-docs.mjs', 'include the executable docs gate');

requirePattern(
  'architecture',
  /^# Architecture and data flow$/m,
  'define the architecture reference',
);
requirePattern('architecture', /core engines/i, 'describe the pure core layer');
requirePattern('architecture', /boundary (?:packages|layer)/i, 'describe I/O boundaries');
requirePattern('architecture', /MCP/i, 'describe MCP placement');
requirePattern('architecture', /StatProvider/i, 'describe provider injection');

requirePattern(
  'security',
  /^# Security, privacy, and threat model$/m,
  'define the threat-model reference',
);
for (const term of [
  'trust boundaries',
  'untrusted input',
  'private user data',
  'stdout',
  'stderr',
]) {
  requirePattern('security', new RegExp(term, 'i'), `cover ${term}`);
}
requirePattern('security', /does not fetch live odds/i, 'state the MCP network/data non-goal');
requireText('security', 'SECURITY.md', 'link the vulnerability-reporting policy');

requirePattern(
  'versioning',
  /^# Versioning, compatibility, and support$/m,
  'define the release policy',
);
requirePattern('versioning', /independent package/i, 'document smallest-scope package releases');
requirePattern('versioning', /Node(?:\.js)? (?:>=|≥) 22/i, 'state the supported Node floor');
requirePattern('versioning', /changesets/i, 'document release planning');
requirePattern('versioning', /migration/i, 'document migration expectations');
requirePattern('versioning', /release\/ios-2\.0\.0/i, 'separate the mobile app snapshot');

const packageNames = [
  '@buzzr/dfs-engine',
  '@buzzr/bets-core',
  '@buzzr/entertainment-engine',
  '@buzzr/mcp',
  '@buzzr/dfs-cli',
  '@buzzr/dfs-react',
  '@buzzr/dfs-testkit',
  '@buzzr/dfs-provider-espn',
  '@buzzr/dfs-provider-sportradar',
  '@buzzr/dfs-engine-test-vectors',
];
for (const packageName of packageNames) {
  requireText('apiIndex', packageName, `index ${packageName}`);
}
requirePattern(
  'apiIndex',
  /TypeDoc[^\n]*currently[^\n]*@buzzr\/dfs-engine[^\n]*only/i,
  'scope the generated API reference honestly',
);

for (const [key, content] of Object.entries(docs)) {
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const href = match[1].trim();
    if (/^(?:https?:|mailto:|#)/i.test(href)) continue;
    if (['link', 'url'].includes(href.toLowerCase())) continue;

    const withoutAnchor = href.split('#', 1)[0].replace(/^<|>$/g, '');
    const target = resolve(dirname(`${root}${files[key]}`), decodeURIComponent(withoutAnchor));
    await access(target).catch(() => {
      assert.fail(`${files[key]} contains a missing local link: ${href}`);
    });
  }
}

console.log(`Public docs contract passed for ${publicKeys.length} files.`);
