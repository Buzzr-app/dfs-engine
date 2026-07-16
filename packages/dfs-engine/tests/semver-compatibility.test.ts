import { describe, expect, test } from 'vitest';
import { createDfsEngine, defineBookPolicy } from '../src';

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

  test('preserves v5 shallow-freeze behavior for defineBookPolicy nested values', () => {
    const defined = defineBookPolicy({
      id: 'compat-book',
      displayName: 'Compatibility Book',
      version: '1',
      effectiveFrom: '2026-01-01',
      status: 'draft',
      sources: [{ label: 'Mutable nested source' }],
      playTypes: [
        {
          id: 'power',
          displayName: 'Power',
          payoutModel: 'displayed-multiplier',
          pickCount: { min: 2, max: 4 },
        },
      ],
      tiePolicy: { type: 'push' },
      dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
      pushPolicy: { type: 'remove_leg', refundIfNoSurvivors: true },
      payoutSplit: { type: 'all_withdrawable' },
    });

    expect(() => {
      defined.sources[0].note = 'still mutable in the legacy definition API';
      defined.playTypes[0].pickCount.min = 1;
    }).not.toThrow();
    expect(defined.sources[0].note).toBe('still mutable in the legacy definition API');
    expect(defined.playTypes[0].pickCount.min).toBe(1);
  });
});
