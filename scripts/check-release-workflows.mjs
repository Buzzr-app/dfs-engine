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
for (const command of [
  'npm run check:docs',
  'npm run check:links',
  'npm run check:links:external',
]) {
  assert.ok(ci.includes(`run: ${command}`), `CI must run ${command}`);
}

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
assert.match(
  release,
  /^  publish-npm:\n    needs:\s+authorize-release$/m,
  'the OIDC publish job must depend on unprivileged release authorization',
);
const authorizeJobStart = release.indexOf('  authorize-release:');
const publishJobStart = release.indexOf('  publish-npm:');
const githubReleaseJobStart = release.indexOf('  github-release:');
assert.notEqual(authorizeJobStart, -1, 'release must define the authorization job');
assert.notEqual(publishJobStart, -1, 'release must define the npm publish job');
assert.notEqual(githubReleaseJobStart, -1, 'release must define the GitHub release job');
const authorizeJob = release.slice(authorizeJobStart, publishJobStart);
const publishJob = release.slice(publishJobStart, githubReleaseJobStart);
assert.match(
  authorizeJob,
  /^    permissions:\n      contents:\s+read$/m,
  'release inputs must be authorized in an unprivileged read-only job',
);
assert.doesNotMatch(
  authorizeJob,
  /^      (contents|id-token|packages|pages):\s+write$/m,
  'release authorization must not receive write permissions',
);
assert.match(
  authorizeJob,
  /gh api "repos\/\$GITHUB_REPOSITORY\/git\/ref\/heads\/main"/,
  'release authorization must resolve the current main ref through GitHub',
);
assert.match(
  authorizeJob,
  /test "\$REMOTE_MAIN" = "\$EXPECTED_COMMIT"/,
  'release authorization must require the reviewed commit to equal current main',
);
assert.match(
  authorizeJob,
  /test "\$GITHUB_SHA_AT_DISPATCH" = "\$EXPECTED_COMMIT"/,
  'release authorization must bind the input to the reviewed dispatch SHA',
);
const privilegedMainCheck = publishJob.indexOf('name: Revalidate current main before checkout');
const privilegedCheckout = publishJob.indexOf('uses: actions/checkout@');
assert.ok(
  privilegedMainCheck >= 0 && privilegedMainCheck < privilegedCheckout,
  'the OIDC job must revalidate current main before checking out repository code',
);
assert.doesNotMatch(
  publishJob.slice(0, privilegedMainCheck),
  /^\s+(uses|run):/m,
  'the current-main revalidation must be the OIDC job first step',
);
assert.match(
  publishJob.slice(privilegedMainCheck, privilegedCheckout),
  /test "\$REMOTE_MAIN" = "\$EXPECTED_COMMIT"/,
  'the OIDC job must stop if main moved after authorization',
);
assert.match(publishJob, /^    environment:\s+npm$/m, 'the OIDC job must use the npm environment');
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
assert.match(release, /gh release view/, 'GitHub release creation must be safe to rerun');
assert.doesNotMatch(release, /NPM_TOKEN|NODE_AUTH_TOKEN|secrets\./, 'release must not use tokens');
for (const variable of ['EXPECTED_MCP_VERSION', 'EXPECTED_MCP_INTEGRITY', 'EXPECTED_GIT_HEAD']) {
  assert.match(
    proof,
    new RegExp(`^          ${variable}:`, 'm'),
    `published proof must pass ${variable}`,
  );
}

const docs = workflows.find(({ path }) => path.endsWith('/docs.yml'))?.body ?? '';
assert.doesNotMatch(docs, /^\s+tags:\s*$/m, 'docs must not deploy directly from mutable tags');
assert.match(docs, /^\s+branches:\n\s+- main$/m, 'docs push deployments must come from main');
const docsBuildStart = docs.indexOf('  build:');
const docsDeployStart = docs.indexOf('  deploy:');
assert.notEqual(docsBuildStart, -1, 'docs must define the build job');
assert.notEqual(docsDeployStart, -1, 'docs must define the deploy job');
const docsBuild = docs.slice(docsBuildStart, docsDeployStart);
const docsDeploy = docs.slice(docsDeployStart);
assert.match(
  docsBuild,
  /^    permissions:\n      contents:\s+read$/m,
  'docs build must use explicit contents-read-only permissions',
);
assert.doesNotMatch(
  docsBuild,
  /^      (pages|id-token):\s+write$/m,
  'docs build must not receive deployment credentials',
);
assert.match(docsDeploy, /^      pages:\s+write$/m, 'only docs deploy may write Pages');
assert.match(docsDeploy, /^      id-token:\s+write$/m, 'only docs deploy may mint the Pages token');

const rootPackage = JSON.parse(await readFile('package.json', 'utf8'));
assert.match(rootPackage.scripts.verify, /npm run check:workflows/, 'verify must check workflows');
assert.match(rootPackage.scripts.verify, /npm run audit:high/, 'verify must reject high-risk advisories');
assert.equal(
  rootPackage.scripts['check:links'],
  'node scripts/check-doc-links.mjs',
  'package scripts must expose the complete local documentation link check',
);
assert.equal(
  rootPackage.scripts['check:links:external'],
  'node scripts/check-doc-links.mjs --external',
  'package scripts must expose the external documentation link check',
);
assert.match(rootPackage.scripts.verify, /npm run check:links/, 'verify must check local doc links');

console.log(`Verified ${workflowPaths.length} release workflows use bounded, immutable controls.`);
