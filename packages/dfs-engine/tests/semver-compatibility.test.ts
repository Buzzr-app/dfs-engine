import { describe, expect, test } from 'vitest';
import { createDfsEngine } from '../src';

describe('minor-version compatibility metadata', () => {
  test('keeps optional policy metadata present on engine-produced results', async () => {
    const result = await createDfsEngine().settleEntry({
      entryId: 'runtime-metadata',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      legs: [],
    });

    expect(Object.hasOwn(result, 'policyStatus')).toBe(true);
    expect(Object.hasOwn(result, 'policyVerification')).toBe(true);
    expect(Object.hasOwn(result, 'payoutTable')).toBe(true);
  });
});
