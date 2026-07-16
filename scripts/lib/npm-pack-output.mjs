import assert from 'node:assert/strict';

function parseJsonTail(output) {
  const offsets = [0];
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] === '\n') {
      offsets.push(index + 1);
    }
  }

  for (const offset of offsets.reverse()) {
    const candidate = output.slice(offset).trim();
    if (!candidate.startsWith('[') && !candidate.startsWith('{')) {
      continue;
    }
    try {
      return JSON.parse(candidate);
    } catch {
      // Lifecycle output may contain earlier JSON-looking lines. Keep searching for the final result.
    }
  }
  return undefined;
}

export function parseNpmPackArtifacts(output, workspace) {
  const parsed = parseJsonTail(output);
  assert.notEqual(parsed, undefined, `Could not parse npm pack JSON output for ${workspace}`);

  let artifacts;
  if (Array.isArray(parsed)) {
    artifacts = parsed;
  } else {
    assert(
      parsed && typeof parsed === 'object' && Object.hasOwn(parsed, workspace),
      `Expected npm pack output for ${workspace}`,
    );
    assert.equal(Object.keys(parsed).length, 1, `Expected one packed artifact for ${workspace}`);
    artifacts = [parsed[workspace]];
  }

  assert.equal(artifacts.length, 1, `Expected one packed artifact for ${workspace}`);
  assert(
    artifacts[0] && typeof artifacts[0] === 'object',
    `Expected one packed artifact for ${workspace}`,
  );
  assert.equal(artifacts[0].name, workspace, `Packed the wrong workspace for ${workspace}`);
  return artifacts;
}
