import { describe, expect, test } from 'vitest';
import { createDfsEngine, defineStatProvider, type StatProvider } from '@buzzr/dfs-engine';
import { formatLegLabel, formatLegLine, getSlipDisplayModel, getStatusTone } from '../src';

const baseRow = {
  date: '2026-05-07T00:00:00.000Z',
  minutes: '34:00',
  assists: '5',
  steals: '1',
  blocks: '0',
  turnovers: '2',
  threeP: '3',
};

const provider: StatProvider = defineStatProvider({
  id: 'mock',
  getGameLog({ leg }) {
    if (leg.legId === 'leg-1') {
      return [{ ...baseRow, points: '28', rebounds: '6' }];
    }
    if (leg.legId === 'leg-2') {
      return [{ ...baseRow, points: '14', rebounds: '9' }];
    }
    return [];
  },
});

describe('@buzzr/dfs-react', () => {
  test('getStatusTone maps engine outcomes to display tones', () => {
    expect(getStatusTone('won')).toBe('win');
    expect(getStatusTone('lost')).toBe('loss');
    expect(getStatusTone('push')).toBe('push');
    expect(getStatusTone('pushed')).toBe('push');
    expect(getStatusTone('void')).toBe('void');
    expect(getStatusTone('canceled')).toBe('void');
    expect(getStatusTone('rescued')).toBe('void');
    expect(getStatusTone('manual')).toBe('void');
    expect(getStatusTone('dnp')).toBe('void');
    expect(getStatusTone('pending')).toBe('pending');
    expect(getStatusTone('unknown-status')).toBe('pending');
  });

  test('formatLegLabel + formatLegLine produce slip-style strings', () => {
    const leg = {
      legId: 'leg-1',
      status: 'won' as const,
      actual: 28,
      line: 24.5,
      direction: 'over' as const,
      playerName: 'A. Example',
      propType: 'Points',
      provider: { source: 'stat-provider' as const, providerId: 'mock' },
    };
    expect(formatLegLabel(leg)).toBe('A. Example — Points');
    expect(formatLegLine(leg)).toBe('o24.5');
    expect(formatLegLine({ ...leg, direction: 'under' as const })).toBe('u24.5');
  });

  test('getSlipDisplayModel projects a settlement result into a view-model', async () => {
    const engine = createDfsEngine({ statProviders: [provider] });
    const result = await engine.settleEntry(
      {
        entryId: 'entry-1',
        bookId: 'prizepicks',
        playTypeId: 'power',
        stake: 10,
        displayedMultiplier: 3,
        legs: [
          {
            legId: 'leg-1',
            playerName: 'A. Example',
            playerId: 'athlete-1',
            league: 'NBA',
            propType: 'Points',
            line: 24.5,
            direction: 'over',
            actual: null,
            status: 'pending',
            gameDate: '2026-05-07T00:00:00.000Z',
          },
          {
            legId: 'leg-2',
            playerName: 'B. Other',
            playerId: 'athlete-2',
            league: 'NBA',
            propType: 'Rebounds',
            line: 7.5,
            direction: 'over',
            actual: null,
            status: 'pending',
            gameDate: '2026-05-07T00:00:00.000Z',
          },
        ],
      },
      { statProviderId: 'mock' },
    );

    const model = getSlipDisplayModel(result);
    expect(model.entryId).toBe('entry-1');
    expect(model.tone).toBe('win');
    expect(model.stakeLabel).toBe('$10.00');
    expect(model.multiplierLabel.endsWith('x')).toBe(true);
    expect(model.legs[0]?.label).toBe('A. Example — Points');
    expect(model.legs[0]?.line).toBe('o24.5');
    expect(model.legs[0]?.tone).toBe('win');
    expect(model.legs[0]?.actual).toBe(28);
  });
});
