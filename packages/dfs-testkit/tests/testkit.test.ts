import { describe, expect, test } from 'vitest';
import { createDfsEngine, validateDfsEntryInput } from '@buzzr/dfs-engine';
import {
  createMockStatProvider,
  makeDfsEntry,
  makeDfsLeg,
  makeGameLogEntry,
  makeInvalidDfsEntry,
} from '../src';

describe('@buzzr/dfs-testkit', () => {
  test('builds golden-style entries and mock stat providers for settlement tests', async () => {
    const provider = createMockStatProvider({
      'leg-1': [makeGameLogEntry({ points: '28' })],
      'leg-2': [makeGameLogEntry({ rebounds: '9' })],
    });
    const engine = createDfsEngine({ statProviders: [provider] });

    const result = await engine.settleEntry(
      makeDfsEntry({
        legs: [
          makeDfsLeg({ legId: 'leg-1', playerId: 'athlete-1', line: 24.5 }),
          makeDfsLeg({
            legId: 'leg-2',
            playerId: 'athlete-2',
            propType: 'Rebounds',
            line: 7.5,
          }),
        ],
      }),
      { statProviderId: provider.id },
    );

    expect(result.status).toBe('won');
    expect(result.legs[0]?.actual).toBe(28);
  });

  test('emits canonical v4 fixtures and invalid-entry helpers for consumers', () => {
    const valid = makeDfsEntry();
    expect(valid.legs[0]).toMatchObject({ actual: null, status: 'pending' });
    expect(valid.legs[0]).not.toHaveProperty('stat');
    expect(valid.legs[0]).not.toHaveProperty('legStatus');
    expect(validateDfsEntryInput(valid).ok).toBe(true);

    const invalid = validateDfsEntryInput(makeInvalidDfsEntry());
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.errors.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(['validation.stake_positive', 'validation.duplicate_leg_id']),
      );
    }
  });
});
