import { describe, expect, test } from 'vitest';
import {
  adaptV2EntryInput,
  createDfsEngine,
  defineBookPolicy,
  definePayoutTable,
  DRAFT_BOOK_POLICY_FIXTURES,
  type DfsEntryInput,
  type DfsLegInput,
} from '../src';

const leg = (overrides: Partial<DfsLegInput> = {}): DfsLegInput => ({
  legId: 'leg-1',
  playerName: 'Fixture Player',
  league: 'NBA',
  propType: 'Points',
  line: 10,
  direction: 'over',
  ...overrides,
});

const entry = (overrides: Partial<DfsEntryInput> = {}): DfsEntryInput => ({
  entryId: 'entry-1',
  bookId: 'custom-book',
  playTypeId: 'all-in',
  stake: 10,
  displayedMultiplier: 5,
  legs: [leg(), leg({ legId: 'leg-2', line: 7.5, propType: 'Rebounds' })],
  ...overrides,
});

const customPolicy = defineBookPolicy({
  id: 'custom-book',
  displayName: 'Custom Book',
  version: '2026-05',
  effectiveFrom: '2026-05-01',
  status: 'stable',
  sources: [{ label: 'Fixture rules', url: 'https://example.com/rules' }],
  playTypes: [
    {
      id: 'all-in',
      displayName: 'All-In',
      payoutModel: 'fixed-table',
      pickCount: { min: 2, max: 3 },
    },
    {
      id: 'trust-slip',
      displayName: 'Trust Slip',
      payoutModel: 'displayed-multiplier',
      pickCount: { min: 2, max: 4 },
    },
  ],
  tiePolicy: { type: 'more_wins_less_loses' },
  dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
  pushPolicy: { type: 'remove_leg', refundIfNoSurvivors: true },
  payoutSplit: { type: 'all_withdrawable' },
  validation: {
    duplicatePlayers: 'error',
    sameTeam: 'allow',
    sameGame: 'allow',
  },
});

describe('Book Policy Registry 3.0', () => {
  test('settles a non-PrizePicks custom book with bookId/playTypeId and policy metadata', async () => {
    const engine = createDfsEngine({
      bookPolicies: [customPolicy],
      payoutTables: [
        definePayoutTable({
          bookId: 'custom-book',
          playTypeId: 'all-in',
          effectiveFrom: '2026-05-01',
          entries: [
            { pickCount: 2, hits: 2, multiplier: 7 },
            { pickCount: 2, hits: 1, multiplier: 0 },
          ],
        }),
      ],
    });

    const result = await engine.settleEntry(entry(), {
      actualsByLegId: { 'leg-1': 12, 'leg-2': 8 },
    });

    expect(result.bookId).toBe('custom-book');
    expect(result.playTypeId).toBe('all-in');
    expect(result.policyVersion).toBe('2026-05');
    expect(result.sourceRefs).toEqual([{ label: 'Fixture rules', url: 'https://example.com/rules' }]);
    expect(result.status).toBe('won');
    expect(result.effectiveMultiplier).toBe(7);
    expect(result.payout).toEqual({ total: 70, withdrawable: 70, bonus: 0 });
    expect(result.confidence).toBe('high');
    expect(result.explanationCodes).toContain('settlement.fixed_table_payout');
  });

  test('keeps custom book policy registries isolated per engine instance', () => {
    const engineWithBook = createDfsEngine({ bookPolicies: [customPolicy] });
    const defaultEngine = createDfsEngine();

    expect(engineWithBook.getRegisteredBooks()).toContain('custom-book');
    expect(defaultEngine.getRegisteredBooks()).not.toContain('custom-book');
  });

  test('applies book-specific tie policy where MORE ties win and LESS ties lose', async () => {
    const engine = createDfsEngine({
      bookPolicies: [customPolicy],
      payoutTables: [
        definePayoutTable({
          bookId: 'custom-book',
          playTypeId: 'all-in',
          effectiveFrom: '2026-05-01',
          entries: [{ pickCount: 2, hits: 1, multiplier: 2 }],
        }),
      ],
    });

    const result = await engine.settleEntry(
      entry({
        legs: [
          leg({ legId: 'more-tie', line: 10, direction: 'over' }),
          leg({ legId: 'less-tie', line: 10, direction: 'under' }),
        ],
      }),
      { actualsByLegId: { 'more-tie': 10, 'less-tie': 10 } },
    );

    expect(result.legs.map((decision) => [decision.legId, decision.status])).toEqual([
      ['more-tie', 'won'],
      ['less-tie', 'lost'],
    ]);
    expect(result.status).toBe('won');
    expect(result.effectiveMultiplier).toBe(2);
  });

  test('supports displayed-multiplier books without a payout table', async () => {
    const engine = createDfsEngine({ bookPolicies: [customPolicy] });
    const result = await engine.settleEntry(
      entry({
        playTypeId: 'trust-slip',
        displayedMultiplier: 9.5,
      }),
      { actualsByLegId: { 'leg-1': 12, 'leg-2': 8 } },
    );

    expect(result.status).toBe('won');
    expect(result.effectiveMultiplier).toBe(9.5);
    expect(result.payout.total).toBe(95);
    expect(result.explanationCodes).toContain('settlement.displayed_multiplier_payout');
  });

  test('supports custom payout resolvers', async () => {
    const resolverPolicy = defineBookPolicy({
      ...customPolicy,
      id: 'resolver-book',
      playTypes: [
        {
          id: 'dynamic',
          displayName: 'Dynamic',
          payoutModel: 'custom',
          pickCount: { min: 2, max: 2 },
        },
      ],
      payoutResolver({ stake, hits }) {
        return {
          multiplier: hits === 2 ? 12 : 0,
          payout: { total: hits === 2 ? stake * 12 : 0, withdrawable: hits === 2 ? stake * 12 : 0, bonus: 0 },
          explanationCode: 'fixture.dynamic_resolver',
        };
      },
    });
    const engine = createDfsEngine({ bookPolicies: [resolverPolicy] });

    const result = await engine.settleEntry(
      entry({ bookId: 'resolver-book', playTypeId: 'dynamic' }),
      { actualsByLegId: { 'leg-1': 12, 'leg-2': 8 } },
    );

    expect(result.effectiveMultiplier).toBe(12);
    expect(result.payout.total).toBe(120);
    expect(result.explanationCodes).toContain('fixture.dynamic_resolver');
  });

  test('validates entry rules before settlement', () => {
    const engine = createDfsEngine({ bookPolicies: [customPolicy] });
    const validation = engine.validateEntry(
      entry({
        legs: [
          leg({ legId: 'a', playerId: 'athlete-1' }),
          leg({ legId: 'b', playerId: 'athlete-1' }),
        ],
      }),
    );

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContainEqual({
      code: 'validation.duplicate_player',
      message: 'Duplicate player athlete-1 is not allowed by custom-book.',
      legIds: ['a', 'b'],
    });
  });

  test('adapts v2 app/playType entries into v3 bookId/playTypeId inputs', () => {
    expect(
      adaptV2EntryInput({
        entryId: 'legacy',
        app: 'underdog',
        playType: 'underdog_flex',
        stake: 10,
        displayedMultiplier: 11.5,
        legs: [leg()],
      }),
    ).toMatchObject({
      entryId: 'legacy',
      bookId: 'underdog',
      playTypeId: 'underdog_flex',
      app: undefined,
      playType: undefined,
    });
  });

  test('ships draft policy fixtures as non-built-in sources for future verification', () => {
    expect(DRAFT_BOOK_POLICY_FIXTURES.map((fixture) => fixture.id)).toEqual([
      'sleeper',
      'dabble',
      'parlayplay',
      'draftkings_pick6',
    ]);
    expect(DRAFT_BOOK_POLICY_FIXTURES.every((fixture) => fixture.status === 'draft')).toBe(true);
    expect(createDfsEngine().getRegisteredBooks()).not.toContain('sleeper');
  });
});
