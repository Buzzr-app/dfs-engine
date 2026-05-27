import { describe, expect, test } from 'vitest';
import {
  createDfsEngine,
  defineBookPolicy,
  defineLeagueAdapter,
  definePayoutTable,
  defineStatProvider,
  type DfsBookPolicy,
  type DfsEntryInput,
  type DfsLegInput,
  type PlayerGameLogEntryShape,
} from '../src';

const gameLogEntry = (
  overrides: Partial<PlayerGameLogEntryShape> = {},
): PlayerGameLogEntryShape => ({
  date: '2026-05-07T00:00:00.000Z',
  minutes: '30:00',
  points: '24',
  rebounds: '9',
  assists: '4',
  steals: '1',
  blocks: '1',
  turnovers: '2',
  threeP: '3',
  ...overrides,
});

const leg = (overrides: Partial<DfsLegInput> = {}): DfsLegInput => ({
  legId: 'leg-1',
  playerName: 'Release Guard',
  playerId: 'player-1',
  team: 'NYK',
  gameId: 'game-1',
  league: 'NBA',
  propType: 'Points',
  line: 20.5,
  direction: 'over',
  ...overrides,
});

const entry = (overrides: Partial<DfsEntryInput> = {}): DfsEntryInput => ({
  entryId: 'entry-1',
  bookId: 'guard-book',
  playTypeId: 'main',
  stake: 10,
  displayedMultiplier: 3,
  legs: [leg()],
  ...overrides,
});

const policy = (overrides: Partial<DfsBookPolicy> = {}): DfsBookPolicy =>
  defineBookPolicy({
    id: 'guard-book',
    displayName: 'Guard Book',
    version: '2026-05-test',
    effectiveFrom: '2026-05-01',
    status: 'draft',
    sources: [{ label: 'Release guard fixture' }],
    playTypes: [
      {
        id: 'main',
        displayName: 'Main',
        payoutModel: 'displayed-multiplier',
        pickCount: { min: 1, max: 4 },
      },
    ],
    tiePolicy: { type: 'push' },
    dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
    pushPolicy: { type: 'remove_leg', refundIfNoSurvivors: true },
    payoutSplit: { type: 'all_withdrawable' },
    validation: {
      duplicatePlayers: 'allow',
      sameTeam: 'allow',
      sameGame: 'allow',
    },
    ...overrides,
  });

describe('engine release branch guardrails', () => {
  test('validates registry definitions and runtime registration paths', async () => {
    const validPolicy = policy();

    expect(() => defineBookPolicy({ ...validPolicy, id: '' })).toThrow('id is required');
    expect(() => defineBookPolicy({ ...validPolicy, displayName: '' })).toThrow(
      'displayName is required',
    );
    expect(() => defineBookPolicy({ ...validPolicy, version: '' })).toThrow('version is required');
    expect(() => defineBookPolicy({ ...validPolicy, effectiveFrom: '' })).toThrow(
      'effectiveFrom is required',
    );
    expect(() => defineBookPolicy({ ...validPolicy, playTypes: [] })).toThrow(
      'at least one play type',
    );
    expect(() =>
      defineBookPolicy({
        ...validPolicy,
        playTypes: [
          {
            id: 'main',
            displayName: '',
            payoutModel: 'displayed-multiplier',
            pickCount: { min: 1, max: 1 },
          },
        ],
      }),
    ).toThrow('every play type');
    expect(() =>
      definePayoutTable({
        bookId: '',
        playTypeId: 'main',
        effectiveFrom: '2026-05-01',
        entries: [{ pickCount: 1, hits: 1, multiplier: 2 }],
      }),
    ).toThrow('bookId is required');
    expect(() =>
      definePayoutTable({
        bookId: 'guard-book',
        playTypeId: '',
        effectiveFrom: '2026-05-01',
        entries: [{ pickCount: 1, hits: 1, multiplier: 2 }],
      }),
    ).toThrow('playTypeId is required');
    expect(() =>
      definePayoutTable({
        bookId: 'guard-book',
        playTypeId: 'main',
        effectiveFrom: '2026-05-01',
        entries: [],
      }),
    ).toThrow('entries are required');
    expect(() => defineLeagueAdapter({ league: '' })).toThrow('league is required');
    expect(() =>
      defineStatProvider({
        id: '',
        getGameLog: () => [],
      }),
    ).toThrow('id is required');
    expect(() =>
      defineStatProvider({
        id: 'empty-provider',
      } as Parameters<typeof defineStatProvider>[0]),
    ).toThrow('extractStat or getGameLog');

    const engine = createDfsEngine();
    engine.registerBookPolicy(
      policy({
        id: 'runtime-book',
        playTypes: [
          {
            id: 'main',
            displayName: 'Main',
            payoutModel: 'fixed-table',
            pickCount: { min: 1, max: 1 },
          },
        ],
      }),
    );
    engine.registerPayoutTable(
      definePayoutTable({
        bookId: 'runtime-book',
        playTypeId: 'main',
        effectiveFrom: '2026-05-01',
        entries: [{ pickCount: 1, hits: 1, multiplier: 6 }],
      }),
    );
    engine.registerLeagueAdapter(
      defineLeagueAdapter({
        league: 'SIM2',
        adapters: {
          Points: () => 9,
        },
      }),
    );
    engine.registerStatProvider(
      defineStatProvider({
        id: 'runtime-provider',
        extractStat: () => ({
          ok: true,
          actual: 17,
          source: 'runtime-provider',
        }),
      }),
    );

    expect(engine.getRegisteredBooks()).toContain('runtime-book');
    expect(
      engine.lookupPayout({
        bookId: 'runtime-book',
        playTypeId: 'main',
        stake: 10,
        pickCount: 1,
        hits: 1,
      }),
    ).toMatchObject({ status: 'won', multiplier: 6 });
    await expect(
      engine.extractLegStat(leg({ league: 'SIM2' }), {
        actualEntry: gameLogEntry({ points: '99' }),
        statProviderId: 'not-registered',
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'provider_not_found' });
    await expect(
      engine.extractLegStat(leg(), {
        statProviderId: 'runtime-provider',
      }),
    ).resolves.toMatchObject({ ok: true, value: 17 });
  });

  test('covers explicit stats, provider filtering, provider errors, and stat failures', async () => {
    const skippedProvider = defineStatProvider({
      id: 'skipped-provider',
      extractStat: () => {
        throw new Error('skipped provider should not run');
      },
    });
    const selectedProvider = defineStatProvider({
      id: 'selected-provider',
      extractStat: ({ leg: requestedLeg }) => ({
        ok: true,
        actual: 33,
        source: 'selected-provider',
        sourceRef: requestedLeg.legId,
        confidence: 0.9,
        raw: { selected: true },
      }),
    });
    const failingProvider = defineStatProvider({
      id: 'failing-provider',
      extractStat: () => {
        throw new Error('box score unavailable');
      },
    });
    const engine = createDfsEngine({
      statProviders: [skippedProvider, selectedProvider],
    });

    await expect(engine.extractLegStat(leg({ actual: 12 }))).resolves.toMatchObject({
      ok: true,
      value: 12,
      provenance: { source: 'input' },
    });
    await expect(
      engine.extractLegStat(leg(), {
        statProviderId: 'selected-provider',
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: 33,
      providerId: 'selected-provider',
      provenance: { sourceRef: 'leg-1' },
    });
    await expect(
      createDfsEngine({ statProviders: [failingProvider] }).extractLegStat(leg()),
    ).resolves.toMatchObject({
      ok: false,
      reason: 'provider_error',
      providerId: 'failing-provider',
    });
    await expect(createDfsEngine().extractLegStat(leg())).resolves.toMatchObject({
      ok: false,
      reason: 'missing_provider_data',
    });
    await expect(
      createDfsEngine().extractLegStat(leg({ propType: 'Unsupported Stat' }), {
        actualEntry: gameLogEntry(),
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: 'unsupported_prop',
    });
  });

  test('reports strict validation branches and unknown policy settlement', async () => {
    const strictPolicy = policy({
      id: 'strict-book',
      displayName: 'Strict Book',
      playTypes: [
        {
          id: 'strict',
          displayName: 'Strict',
          payoutModel: 'displayed-multiplier',
          pickCount: { min: 2, max: 2 },
        },
      ],
      validation: {
        leagues: ['NBA'],
        duplicatePlayers: 'error',
        sameTeam: 'warn',
        sameGame: 'error',
      },
    });
    const engine = createDfsEngine({ bookPolicies: [strictPolicy] });
    const validation = engine.validateEntry(
      entry({
        bookId: 'strict-book',
        playTypeId: 'strict',
        legs: [
          leg({ legId: 'a', playerId: 'dup', team: 'NYK', gameId: 'game-1', league: 'NBA' }),
          leg({ legId: 'b', playerId: 'dup', team: 'NYK', gameId: 'game-1', league: 'NFL' }),
          leg({ legId: 'c', playerId: null, playerName: '', team: null, gameId: null }),
        ],
      }),
    );

    expect(validation.ok).toBe(false);
    expect(validation.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'validation.player_name_required',
        'validation.pick_count',
        'validation.league_restricted',
        'validation.duplicate_player',
        'validation.same_game',
      ]),
    );
    expect(validation.warnings.map((issue) => issue.code)).toEqual(['validation.same_team']);

    expect(createDfsEngine().validateEntry(entry({ bookId: 'missing-book' }))).toMatchObject({
      ok: false,
      errors: [{ code: 'validation.unknown_book_or_play_type' }],
    });
    await expect(
      createDfsEngine().settleEntry(entry({ bookId: 'missing-book' })),
    ).resolves.toMatchObject({
      status: 'pending',
      policyVersion: null,
      pendingReasons: ['validation_failed'],
      explanationCodes: expect.arrayContaining(['validation.unknown_book_or_play_type']),
    });
  });

  test('settles manual, push, removed-leg, and custom split branches', async () => {
    const customTiePolicy = policy({
      id: 'custom-tie-book',
      tiePolicy: {
        type: 'custom',
        gradeTie: () => 'won',
      },
      payoutSplit: {
        type: 'custom',
        split: ({ totalPayout }) => ({
          total: totalPayout,
          withdrawable: totalPayout - 1,
          bonus: 1,
        }),
      },
    });
    const manualPushPolicy = policy({
      id: 'manual-push-book',
      pushPolicy: { type: 'manual', reasonCode: 'manual-push' },
    });
    const statusPolicy = policy({
      id: 'status-book',
      playTypes: [
        {
          id: 'main',
          displayName: 'Main',
          payoutModel: 'displayed-multiplier',
          pickCount: { min: 1, max: 4 },
        },
      ],
      dnpPolicy: {
        type: 'custom',
        resolve: () => 'rescued',
      },
    });
    const pushPolicy = policy({
      id: 'push-book',
      playTypes: [
        {
          id: 'main',
          displayName: 'Main',
          payoutModel: 'fixed-table',
          pickCount: { min: 1, max: 2 },
        },
      ],
    });
    const engine = createDfsEngine({
      bookPolicies: [customTiePolicy, manualPushPolicy, statusPolicy, pushPolicy],
      payoutTables: [
        definePayoutTable({
          bookId: 'push-book',
          playTypeId: 'main',
          effectiveFrom: '2026-05-01',
          entries: [
            { pickCount: 1, hits: 1, multiplier: 2 },
            { pickCount: 2, hits: 2, multiplier: 4 },
          ],
        }),
      ],
    });

    await expect(
      engine.settleEntry(
        entry({
          bookId: 'custom-tie-book',
          legs: [leg({ legId: 'tie', line: 20.5 })],
        }),
        {
          actualsByLegId: { tie: 20.5 },
          auditId: 'audit-custom-tie',
        },
      ),
    ).resolves.toMatchObject({
      status: 'won',
      payout: { total: 30, withdrawable: 29, bonus: 1 },
      provenance: { auditId: 'audit-custom-tie' },
    });

    await expect(
      engine.settleEntry(
        entry({
          bookId: 'manual-push-book',
          legs: [leg({ legId: 'manual', line: 10 })],
        }),
        { actualsByLegId: { manual: 10 } },
      ),
    ).resolves.toMatchObject({
      status: 'pending',
      pendingReasons: ['manual_action_required'],
      explanationCodes: expect.arrayContaining(['settlement.manual_action_required']),
    });

    await expect(
      engine.settleEntry(
        entry({
          bookId: 'status-book',
          displayedMultiplier: 4,
          legs: [
            leg({ legId: 'dnp' }),
            leg({ legId: 'voided' }),
            leg({ legId: 'canceled' }),
            leg({ legId: 'won', line: 10 }),
          ],
        }),
        {
          legStatusesByLegId: {
            dnp: 'dnp',
            voided: 'void',
            canceled: 'canceled',
          },
          actualsByLegId: { won: 12 },
        },
      ),
    ).resolves.toMatchObject({
      status: 'won',
      legs: [
        { legId: 'dnp', status: 'rescued' },
        { legId: 'voided', status: 'void' },
        { legId: 'canceled', status: 'canceled' },
        { legId: 'won', status: 'won' },
      ],
      explanationCodes: expect.arrayContaining(['settlement.repriced_after_removed_legs']),
    });

    await expect(
      engine.settleEntry(
        entry({
          bookId: 'push-book',
          legs: [leg({ legId: 'push', line: 10 }), leg({ legId: 'winner', line: 10 })],
        }),
        {
          actualsByLegId: {
            push: 10,
            winner: 12,
          },
        },
      ),
    ).resolves.toMatchObject({
      status: 'won',
      multiplier: 2,
      explanationCodes: expect.arrayContaining([
        'leg.push_removed',
        'settlement.repriced_after_removed_legs',
      ]),
    });
  });

  test('covers payout fallback and all-or-nothing branches', () => {
    expect(() =>
      policy({
        id: 'bad-custom-payout-book',
        playTypes: [
          {
            id: 'custom-empty',
            displayName: 'Custom Empty',
            payoutModel: 'custom',
            pickCount: { min: 1, max: 1 },
          },
        ],
      }),
    ).toThrow('custom payout model requires payoutResolver');

    const payoutPolicy = policy({
      id: 'payout-book',
      playTypes: [
        {
          id: 'all-or-nothing',
          displayName: 'All Or Nothing',
          payoutModel: 'fixed-table',
          allOrNothing: true,
          pickCount: { min: 2, max: 2 },
        },
        {
          id: 'fixed-empty',
          displayName: 'Fixed Empty',
          payoutModel: 'fixed-table',
          pickCount: { min: 1, max: 1 },
        },
      ],
    });
    const engine = createDfsEngine({ bookPolicies: [payoutPolicy] });

    expect(
      engine.lookupPayout({
        bookId: 'payout-book',
        playTypeId: 'all-or-nothing',
        stake: 10,
        pickCount: 2,
        hits: 1,
        losses: 1,
      }),
    ).toMatchObject({
      status: 'lost',
      multiplier: 0,
      explanationCode: 'settlement.all_or_nothing_loss',
    });
    expect(
      engine.lookupPayout({
        bookId: 'payout-book',
        playTypeId: 'fixed-empty',
        stake: 10,
        pickCount: 1,
        hits: 1,
      }),
    ).toMatchObject({
      status: 'lost',
      confidence: 'low',
      explanationCode: 'settlement.no_payout_table_row',
    });
  });
});
