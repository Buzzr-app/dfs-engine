import assert from 'node:assert/strict';

function parseSingleNpmViewResult(output, message) {
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed)) {
    return parsed;
  }
  assert.equal(parsed.length, 1, message);
  return parsed[0];
}

export function parseNpmViewValue(output, label) {
  return parseSingleNpmViewResult(output, `Expected one npm view value for ${label}`);
}

export function parseNpmViewMetadata(output, expectedName) {
  const metadata = parseSingleNpmViewResult(
    output,
    `Expected one npm view result for ${expectedName}`,
  );
  assert(
    metadata && typeof metadata === 'object' && !Array.isArray(metadata),
    `Expected one npm view result for ${expectedName}`,
  );
  assert.equal(metadata.name, expectedName, `Viewed the wrong package for ${expectedName}`);
  return metadata;
}
