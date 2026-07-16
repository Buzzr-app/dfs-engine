import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowPaths = [
  '.github/workflows/ci.yml',
  '.github/workflows/docs.yml',
  '.github/workflows/prove-mcp-published.yml',
  '.github/workflows/release.yml',
];

const workflows = await Promise.all(
  workflowPaths.map(async (path) => ({ path, body: await readFile(path, 'utf8') })),
);

for (const { path, body } of workflows) {
  const mutableActionRefs = [...body.matchAll(/uses:\s+[^\s#]+@(v\d+|main|master)\b/g)].map(
    (match) => match[0],
  );
  assert.deepEqual(mutableActionRefs, [], `${path} must pin every action to a commit SHA`);

  for (const match of body.matchAll(/uses:\s+actions\/checkout@[0-9a-f]{40}/g)) {
    const step = body.slice(match.index, match.index + 240);
    assert.match(
      step,
      /persist-credentials:\s+false/,
      `${path} checkout steps must disable persisted credentials`,
    );
  }

  const jobCount = [...body.matchAll(/^    runs-on:\s+/gm)].length;
  const timeoutCount = [...body.matchAll(/^    timeout-minutes:\s+\d+\s*$/gm)].length;
  assert.equal(timeoutCount, jobCount, `${path} must bound every job with timeout-minutes`);
}

const ci = workflows.find(({ path }) => path.endsWith('/ci.yml'))?.body ?? '';
assert.match(ci, /^permissions:\n  contents:\s+read$/m, 'CI must use explicit read-only permissions');

const proof = workflows.find(({ path }) => path.endsWith('/prove-mcp-published.yml'))?.body ?? '';
for (const input of ['expected_version', 'expected_integrity', 'expected_git_head']) {
  assert.match(proof, new RegExp(`^      ${input}:$`, 'm'), `published proof must require ${input}`);
}

const release = workflows.find(({ path }) => path.endsWith('/release.yml'))?.body ?? '';
for (const input of ['expected_version', 'expected_commit', 'confirm_publish']) {
  assert.match(release, new RegExp(`^      ${input}:$`, 'm'), `release must require ${input}`);
}
assert.match(release, /^      id-token:\s+write$/m, 'npm publish job must mint an OIDC token');
assert.match(release, /^    environment:\s+npm$/m, 'npm publish job must use the npm environment');
assert.match(release, /node-version:\s+24/, 'release must use Node 24');
assert.match(release, /npm@12\.0\.1/, 'release must pin the reviewed npm CLI');
assert.match(
  release,
  /package-manager-cache:\s+false/,
  'release builds must disable package-manager caching',
);
assert.match(release, /npm exec changeset publish/, 'release must publish through Changesets');
assert.match(release, /NPM_CONFIG_PROVENANCE:\s+['"]true['"]/, 'release must request provenance');
assert.match(release, /npm run proof:mcp:published/, 'release must prove the exact live MCP artifact');
assert.match(release, /gh release create/, 'release must create the reviewed GitHub release');
assert.doesNotMatch(release, /NPM_TOKEN|NODE_AUTH_TOKEN|secrets\./, 'release must not use tokens');
for (const variable of ['EXPECTED_MCP_VERSION', 'EXPECTED_MCP_INTEGRITY', 'EXPECTED_GIT_HEAD']) {
  assert.match(
    proof,
    new RegExp(`^          ${variable}:`, 'm'),
    `published proof must pass ${variable}`,
  );
}

const rootPackage = JSON.parse(await readFile('package.json', 'utf8'));
assert.match(rootPackage.scripts.verify, /npm run check:workflows/, 'verify must check workflows');
assert.match(rootPackage.scripts.verify, /npm run audit:high/, 'verify must reject high-risk advisories');

console.log(`Verified ${workflowPaths.length} release workflows use bounded, immutable controls.`);
