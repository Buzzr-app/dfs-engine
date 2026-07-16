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
assert.match(
  ci,
  /^permissions:\n  contents:\s+read$/m,
  'CI must use explicit read-only permissions',
);
for (const command of [
  'npm run check:docs',
  'npm run check:links',
  'npm run check:links:external',
]) {
  assert.ok(ci.includes(`run: ${command}`), `CI must run ${command}`);
}
assert.match(
  ci,
  /- if: matrix\.node == 24\n\s+run: npm install --global npm@12\.0\.1/,
  'Node 24 CI must use the exact npm CLI pinned by the release workflow',
);
assert.match(
  ci,
  /- run: npm run test:packages:packed/,
  'Every supported Node CI job must exercise the complete packed-package suite',
);

const proof = workflows.find(({ path }) => path.endsWith('/prove-mcp-published.yml'))?.body ?? '';
for (const input of ['expected_version', 'expected_integrity', 'expected_git_head']) {
  assert.match(
    proof,
    new RegExp(`^      ${input}:$`, 'm'),
    `published proof must require ${input}`,
  );
}

const release = workflows.find(({ path }) => path.endsWith('/release.yml'))?.body ?? '';
for (const input of ['expected_version', 'expected_commit', 'confirm_publish']) {
  assert.match(release, new RegExp(`^      ${input}:$`, 'm'), `release must require ${input}`);
}
const authorizeJobStart = release.indexOf('  authorize-release:');
const buildJobStart = release.indexOf('  build-release-artifacts:');
const publishJobStart = release.indexOf('  publish-npm:');
const proofJobStart = release.indexOf('  prove-published-npm:');
const registryJobStart = release.indexOf('  publish-mcp-registry:');
const githubReleaseJobStart = release.indexOf('  github-release:');
assert.notEqual(authorizeJobStart, -1, 'release must define the authorization job');
assert.notEqual(buildJobStart, -1, 'release must define the unprivileged build job');
assert.notEqual(publishJobStart, -1, 'release must define the npm publish job');
assert.notEqual(proofJobStart, -1, 'release must define the unprivileged npm proof job');
assert.notEqual(registryJobStart, -1, 'release must define the MCP Registry publish job');
assert.notEqual(githubReleaseJobStart, -1, 'release must define the GitHub release job');
assert.ok(
  authorizeJobStart < buildJobStart &&
    buildJobStart < publishJobStart &&
    publishJobStart < proofJobStart &&
    proofJobStart < registryJobStart &&
    registryJobStart < githubReleaseJobStart,
  'release jobs must keep authorization, build, publish, proof, registry, and release separated',
);
const authorizeJob = release.slice(authorizeJobStart, buildJobStart);
const buildJob = release.slice(buildJobStart, publishJobStart);
const publishJob = release.slice(publishJobStart, proofJobStart);
const proofJob = release.slice(proofJobStart, registryJobStart);
const registryJob = release.slice(registryJobStart, githubReleaseJobStart);
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
assert.doesNotMatch(
  authorizeJob,
  /test "\$REMOTE_MAIN" = "\$EXPECTED_COMMIT"/,
  'authorization must not block an exact partial-release recovery after main advances',
);
assert.doesNotMatch(
  authorizeJob,
  /test "\$GITHUB_SHA_AT_DISPATCH" = "\$EXPECTED_COMMIT"/,
  'authorization must allow a historical reviewed main commit only for downstream exact-artifact recovery',
);
assert.equal(
  [...authorizeJob.matchAll(/repos\/\$GITHUB_REPOSITORY\/compare\//g)].length,
  2,
  'authorization must prove both expected-to-dispatch and dispatch-to-current-main ancestry',
);
assert.match(
  authorizeJob,
  /compare\/\$EXPECTED_COMMIT\.\.\.\$GITHUB_SHA_AT_DISPATCH[\s\S]*test "\$EXPECTED_MERGE_BASE" = "\$EXPECTED_COMMIT"/,
  'the reviewed release commit must be an ancestor of main at dispatch',
);
assert.match(
  authorizeJob,
  /compare\/\$GITHUB_SHA_AT_DISPATCH\.\.\.\$REMOTE_MAIN[\s\S]*test "\$DISPATCH_MERGE_BASE" = "\$GITHUB_SHA_AT_DISPATCH"/,
  'main at dispatch must still be an ancestor of current main',
);
assert.match(
  authorizeJob,
  /release-manifest\.json\?ref=\$EXPECTED_COMMIT/,
  'authorization must hash the release manifest from the exact reviewed commit',
);
assert.match(
  authorizeJob,
  /manifest-sha512=/,
  'authorization must export the reviewed release manifest SHA-512',
);
assert.match(
  buildJob,
  /^    needs:\s+authorize-release$/m,
  'the unprivileged build must depend on exact release authorization',
);
assert.match(
  buildJob,
  /^    permissions:\n      contents:\s+read$/m,
  'the build job must use explicit contents-read-only permissions',
);
assert.doesNotMatch(buildJob, /^      id-token:\s+write$/m, 'the build job must not mint OIDC');
assert.match(
  buildJob,
  /uses:\s+actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/,
  'the build must transfer prepacked artifacts with pinned upload-artifact v4.6.2',
);
assert.match(
  buildJob,
  /node scripts\/pack-release-artifacts\.mjs/,
  'the unprivileged job must prepack all authorized npm artifacts',
);
assert.match(
  buildJob,
  /gitHead:\s+process\.env\.EXPECTED_COMMIT/,
  'prepacked manifests must embed the exact reviewed gitHead before leaving the unprivileged job',
);
assert.match(
  publishJob,
  /^    needs:\s+\[authorize-release, build-release-artifacts\]$/m,
  'the npm OIDC job must consume only authorized, prebuilt artifacts',
);
assert.match(publishJob, /^    environment:\s+npm$/m, 'the npm OIDC job must use npm environment');
assert.match(
  publishJob,
  /^    permissions:\n      contents:\s+read\n      id-token:\s+write$/m,
  'the npm publish job must receive only contents-read and OIDC permissions',
);
assert.match(
  publishJob,
  /uses:\s+actions\/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093/,
  'the npm publish job must consume prepacked artifacts with pinned download-artifact v4.3.0',
);
assert.doesNotMatch(
  publishJob,
  /npm (?:ci|install|exec changeset|pack)|npm run (?:build|verify)/,
  'the npm OIDC job must not install, build, verify, pack, or run Changesets',
);
const privilegedCheckout = publishJob.indexOf('uses: actions/checkout@');
const privilegedCommitCheck = publishJob.indexOf(
  'name: Bind npm publication to the reviewed checkout',
);
const privilegedSetup = publishJob.indexOf('uses: actions/setup-node@');
const privilegedDownload = publishJob.indexOf('uses: actions/download-artifact@');
assert.ok(
  privilegedCheckout < privilegedCommitCheck &&
    privilegedCommitCheck < privilegedSetup &&
    privilegedSetup < privilegedDownload,
  'the npm OIDC job must checkout exact code, bind HEAD, then download artifacts',
);
assert.match(
  publishJob.slice(privilegedCheckout, privilegedCommitCheck),
  /ref:\s+\$\{\{ needs\.authorize-release\.outputs\.reviewed-commit \}\}[\s\S]*fetch-depth:\s+1[\s\S]*persist-credentials:\s+false/,
  'the npm OIDC checkout must be shallow, exact, and must not persist GitHub credentials',
);
assert.match(
  publishJob.slice(privilegedCommitCheck, privilegedSetup),
  /test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_COMMIT"/,
  'the npm OIDC job must immediately bind checkout HEAD to the reviewed commit',
);
const privilegedArtifactValidation = publishJob.indexOf(
  'assert.deepEqual(actualFiles, expectedFiles',
);
const privilegedPreflightCounter = publishJob.indexOf('existing_exact_count=0');
const privilegedPreflightLoop = publishJob.indexOf(
  "while IFS=$'\\t' read -r package_name",
  privilegedPreflightCounter,
);
const privilegedConditionalMainGate = publishJob.indexOf(
  'if [[ "$existing_exact_count" -eq 0 ]]; then',
);
const privilegedMainCheck = publishJob.indexOf(
  'REMOTE_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main"',
);
const privilegedPublishLoop = publishJob.indexOf(
  "while IFS=$'\\t' read -r package_name",
  privilegedPreflightLoop + 1,
);
assert.ok(
  privilegedArtifactValidation >= 0 &&
    privilegedArtifactValidation < privilegedPreflightCounter &&
    privilegedPreflightCounter < privilegedPreflightLoop &&
    privilegedPreflightLoop < privilegedConditionalMainGate &&
    privilegedConditionalMainGate < privilegedMainCheck &&
    privilegedMainCheck < privilegedPublishLoop,
  'all five versions must be preflighted before a conditional main gate and the first irreversible npm publish',
);
assert.match(
  publishJob.slice(privilegedPreflightLoop, privilegedConditionalMainGate),
  /test "\$live_integrity" = "\$integrity"[\s\S]*E404/,
  'preflight must reject every integrity mismatch and distinguish only an absent version',
);
assert.equal(
  [...publishJob.matchAll(/Array\.isArray\(parsed\)/g)].length,
  2,
  'both npm integrity reads must normalize npm 12 exact-version arrays',
);
assert.match(
  publishJob.slice(privilegedConditionalMainGate, privilegedPublishLoop),
  /if \[\[ "\$existing_exact_count" -eq 0 \]\]; then[\s\S]*test "\$REMOTE_MAIN" = "\$EXPECTED_COMMIT"[\s\S]*fi/,
  'current main must gate only a brand-new release with no exact artifact already published',
);
assert.doesNotMatch(
  publishJob.slice(privilegedPreflightCounter, privilegedPublishLoop),
  /npm publish/,
  'preflight and the conditional mutable-main gate must finish before any npm publication',
);
assert.match(
  publishJob.slice(privilegedPublishLoop),
  /preexisting_exact\["\$package_name"\][\s\S]*npm publish "\$tarball" --ignore-scripts --provenance/,
  'the publish loop must skip exact existing artifacts and publish only remaining reviewed tarballs',
);
for (const variable of [
  'EXPECTED_COMMIT',
  'EXPECTED_RELEASE_VERSION',
  'EXPECTED_RELEASE_MANIFEST_SHA512',
  'EXPECTED_ARTIFACT_MANIFEST_SHA512',
]) {
  assert.match(
    publishJob,
    new RegExp(`^          ${variable}:`, 'm'),
    `the npm OIDC job must revalidate ${variable}`,
  );
}
assert.match(
  publishJob,
  /assert\.equal\(artifacts\.length, 5/,
  'the npm OIDC job must require exactly five prepacked tarballs',
);
assert.match(
  publishJob,
  /assert\.deepEqual\(actualFiles, expectedFiles/,
  'the npm OIDC job must reject extra and missing transferred files',
);
assert.match(
  publishJob,
  /createHash\(['"]sha512['"]\)/,
  'the npm OIDC job must recompute SHA-512 for transferred manifests and tarballs',
);
assert.match(
  publishJob,
  /assert\.equal\([\s\S]*tarballPackage\.gitHead,[\s\S]*process\.env\.EXPECTED_COMMIT/,
  'the npm OIDC job must prove each tarball manifest is bound to the reviewed gitHead',
);
assert.match(
  publishJob,
  /npm publish "\$tarball" --ignore-scripts --provenance/,
  'the npm OIDC job must publish each literal reviewed tarball with lifecycle scripts disabled',
);
assert.match(
  publishJob,
  /NPM_CONFIG_REGISTRY:\s+https:\/\/registry\.npmjs\.org\//,
  'trusted publication must use the canonical npm registry',
);
for (const config of ['NPM_CONFIG_USERCONFIG', 'NPM_CONFIG_GLOBALCONFIG']) {
  assert.match(
    publishJob,
    new RegExp(`: > "\\$${config}"`),
    `trusted publication must isolate ambient ${config}`,
  );
}
assert.doesNotMatch(
  release,
  /changeset publish/,
  'the release workflow must never let Changesets repack inside the OIDC job',
);
assert.equal(
  [...release.matchAll(/^    environment:\s+npm$/gm)].length,
  1,
  'exactly one release job may use the npm trusted-publishing environment',
);
assert.equal(
  [...release.matchAll(/^      id-token:\s+write$/gm)].length,
  2,
  'only the npm and MCP Registry publication jobs may mint OIDC tokens',
);
assert.equal(
  [
    ...release.matchAll(
      /uses:\s+actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/g,
    ),
  ].length,
  1,
  'release must upload the prepacked npm bundle exactly once',
);
assert.equal(
  [
    ...release.matchAll(
      /uses:\s+actions\/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093/g,
    ),
  ].length,
  1,
  'only the npm OIDC job may download the prepacked npm bundle',
);
assert.equal(
  [...release.matchAll(/npm publish "\$tarball" --ignore-scripts --provenance/g)].length,
  1,
  'the release workflow must contain one controlled literal-tarball publish loop',
);
assert.match(
  proofJob,
  /^    needs:\s+\[authorize-release, build-release-artifacts, publish-npm\]$/m,
  'unprivileged live npm proof must wait for the exact publish',
);
assert.match(
  proofJob,
  /^    permissions:\n      contents:\s+read$/m,
  'the npm proof job must use explicit contents-read-only permissions',
);
assert.doesNotMatch(proofJob, /^      id-token:\s+write$/m, 'npm proof must not mint OIDC');
assert.match(
  proofJob,
  /ref:\s+\$\{\{ github\.sha \}\}/,
  'partial-release recovery must use the protected dispatch commit for repaired proof tooling',
);
assert.match(
  proofJob,
  /contents\/release-manifest\.json\?ref=\$EXPECTED_RELEASE_COMMIT/,
  'partial-release recovery must reload the release manifest from the reviewed artifact commit',
);
for (const variable of ['EXPECTED_RELEASE_MANIFEST_PATH', 'EXPECTED_RELEASE_MANIFEST_SHA512']) {
  assert.match(
    proofJob,
    new RegExp(`^          ${variable}:`, 'm'),
    `the npm proof job must bind ${variable}`,
  );
}
assert.match(release, /node-version:\s+24/, 'release must use Node 24');
assert.match(release, /npm@12\.0\.1/, 'release must pin the reviewed npm CLI');
assert.match(
  release,
  /package-manager-cache:\s+false/,
  'release builds must disable package-manager caching',
);
assert.match(
  proofJob,
  /npm run proof:mcp:published/,
  'release must prove the exact live MCP artifact',
);
assert.match(release, /gh release create/, 'release must create the reviewed GitHub release');
assert.match(release, /gh release view/, 'GitHub release creation must be safe to rerun');
assert.match(
  release,
  /if existing_tag_response="\$\(gh api \\\n\s+"repos\/\$GITHUB_REPOSITORY\/git\/ref\/tags\/\$tag" 2>&1\)"; then/,
  'release recovery must read and verify an existing exact tag before attempting creation',
);
assert.ok(
  release.indexOf('git/ref/tags/$tag') < release.indexOf('--method POST'),
  'the existing-tag lookup must happen before the atomic tag-creation request',
);
assert.match(
  release,
  /\[\[ "\$existing_tag_response" == \*"HTTP 404"\* \]\]/,
  'release may attempt tag creation only after an explicit not-found response',
);
assert.match(
  release,
  /--method POST \\\n\s+"repos\/\$GITHUB_REPOSITORY\/git\/refs"/,
  'release must atomically create the exact tag through the Git refs API',
);
assert.match(
  release,
  /\[\[ "\$tag_response" == \*"HTTP 422"\* \]\]/,
  'release reruns may tolerate only an existing-ref response from tag creation',
);
assert.equal(
  [...release.matchAll(/gh api "repos\/\$GITHUB_REPOSITORY\/commits\/\$tag" --jq '\.sha'/g)].length,
  2,
  'release must peel and verify the tag commit before and after release creation',
);
assert.match(release, /--verify-tag/, 'release creation must require the precreated exact tag');
assert.doesNotMatch(
  release,
  /--target|--generate-notes/,
  'release creation must not retarget a tag or append nondeterministic generated notes',
);
assert.match(
  release,
  /assert\.equal\(process\.env\.EXISTING_BODY, process\.env\.EXPECTED_NOTES\)/,
  'an existing release body must exactly equal the deterministic reviewed notes',
);
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
const postPublishProof = await readFile('scripts/prove-published-release.mjs', 'utf8');
const mcpRegistryProof = await readFile('scripts/prove-mcp-registry-record.mjs', 'utf8');
const releasePacker = await readFile('scripts/pack-release-artifacts.mjs', 'utf8');
const releaseManifest = JSON.parse(await readFile('release-manifest.json', 'utf8'));
const publishedPackages = releaseManifest.packages.filter((entry) => entry.publish);
assert.equal(releaseManifest.packages.length, 10, 'release manifest must cover all ten packages');
assert.equal(publishedPackages.length, 5, 'release manifest must authorize exactly five publishes');
assert.match(
  releasePacker,
  /['"]--ignore-scripts['"]/,
  'release prepacking must not rerun package lifecycle scripts after verified builds',
);
assert.match(
  release,
  /node scripts\/pack-release-artifacts\.mjs/,
  'release must prepack and hash every authorized artifact',
);
assert.match(
  release,
  /EXPECTED_RELEASE_INTEGRITIES/,
  'release must pass the complete reviewed integrity map to published proof',
);
assert.match(
  release,
  /node scripts\/prove-published-release\.mjs/,
  'release must prove every published package from a generic isolated consumer',
);
assert.match(
  release,
  /for attempt in \{1\.\.12\}/,
  'post-publish registry convergence must use bounded retries',
);
assert.match(
  release,
  /RELEASE_ARTIFACTS/,
  'GitHub release notes must receive the complete package and integrity set',
);
assert.match(
  postPublishProof,
  /\['audit', 'signatures'\]/,
  'post-publish proof must verify npm registry signatures for the clean exact install',
);
assert.match(
  postPublishProof,
  /attestations/,
  'post-publish proof must validate provenance attestations',
);
assert.match(
  release,
  /releases\/download\/v1\.7\.9\/mcp-publisher_linux_amd64\.tar\.gz/,
  'MCP publication must pin the reviewed mcp-publisher v1.7.9 asset',
);
assert.match(
  release,
  /ab128162b0616090b47cf245afe0a23f3ef08936fdce19074f5ba0a4469281ac/,
  'MCP publication must verify the reviewed publisher asset SHA-256',
);
assert.doesNotMatch(
  release,
  /releases\/latest|curl[^\n]*\|/,
  'MCP publication must not execute a curl pipe or resolve a mutable latest asset',
);
assert.match(release, /mcp-publisher login github-oidc/, 'MCP publication must use GitHub OIDC');
assert.match(
  release,
  /mcp-publisher publish/,
  'release must publish server.json to the MCP Registry',
);
assert.match(
  release,
  /node scripts\/prove-mcp-registry-record\.mjs/,
  'release must prove the exact live official MCP Registry record',
);
assert.match(
  mcpRegistryProof,
  /registry\.modelcontextprotocol\.io\/v0\.1\/servers/,
  'MCP registry proof must use the official frozen v0.1 API',
);
assert.match(
  registryJob,
  /^    needs:\s+\[authorize-release, prove-published-npm\]$/m,
  'MCP Registry publication must wait for authorization and complete npm proof',
);
assert.match(
  registryJob,
  /^    permissions:\n      contents:\s+read\n      id-token:\s+write$/m,
  'MCP Registry publication must use only contents-read and OIDC permissions',
);
const registryMainCheck = registryJob.indexOf('name: Revalidate current main before checkout');
const registryCheckout = registryJob.indexOf('uses: actions/checkout@');
assert.equal(
  registryMainCheck,
  -1,
  'MCP publication must not recheck mutable main after npm publication',
);
assert.ok(registryCheckout >= 0, 'MCP publication must checkout the reviewed commit');
assert.doesNotMatch(
  proofJob,
  /git\/ref\/heads\/main|REMOTE_MAIN/,
  'live npm proof must continue against the authorized commit after npm publication',
);
assert.doesNotMatch(
  registryJob,
  /git\/ref\/heads\/main|REMOTE_MAIN/,
  'MCP publication must continue against the authorized commit after npm publication',
);
assert.equal(
  [...release.matchAll(/git\/ref\/heads\/main/g)].length,
  2,
  'mutable main may be checked only during authorization and immediately before npm publication',
);
const publisherDownload = registryJob.indexOf('curl --proto');
const publisherChecksum = registryJob.indexOf('sha256sum --check --strict');
const publisherExtract = registryJob.indexOf('tar --extract');
assert.ok(
  publisherDownload >= 0 &&
    publisherDownload < publisherChecksum &&
    publisherChecksum < publisherExtract,
  'MCP publisher must be downloaded, checksum-verified, then extracted in that order',
);
assert.match(
  registryJob,
  /MCP_REGISTRY_ALLOW_MISSING=1/,
  'reruns must distinguish an exact existing MCP record from a missing record',
);
assert.match(
  release,
  /^  github-release:\n    needs:\s+\[authorize-release, build-release-artifacts, prove-published-npm, publish-mcp-registry\]$/m,
  'GitHub release creation must wait for exact artifacts and both live registry proofs',
);
assert.match(rootPackage.scripts.verify, /npm run check:workflows/, 'verify must check workflows');
assert.match(
  rootPackage.scripts.verify,
  /npm run test:release-supply-chain/,
  'verify must execute release supply-chain regression tests',
);
assert.match(
  rootPackage.scripts.verify,
  /npm run audit:high/,
  'verify must reject high-risk advisories',
);
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
assert.match(
  rootPackage.scripts.verify,
  /npm run check:links/,
  'verify must check local doc links',
);

console.log(`Verified ${workflowPaths.length} release workflows use bounded, immutable controls.`);
