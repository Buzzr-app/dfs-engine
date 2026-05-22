import { describe, expect, test, vi } from 'vitest';
import {
  createDfsEngine,
  defineBookPolicy,
  defineLeagueAdapter,
  definePayoutTable,
  defineStatProvider,
  recalcMultiplierAfterDnp,
  validateDfsEntryInput,
  validateDfsLegInput,
  validateDfsSettlementContext,
  assertValidDfsEntryInput,
  DfsDefinitionError,
  DfsEngineInvariantError,
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
  playerName: 'V4 Guard',
  playerId: 'player-1',
  team: 'NYK',
  gameId: 'game-1',
  gameDate: '2026-05-07T00:00:00.000Z',
  league: 'NBA',
  propType: 'Points',
  line: 20.5,
  direction: 'over',
  actual: null,
  status: 'pending',
  ...overrides,
});

const entry = (overrides: Partial<DfsEntryInput> = {}): DfsEntryInput => ({
  entryId: 'entry-1',
  bookId: 'v4-book',
  playTypeId: 'main',
  stake: 10,
  displayedMultiplier: 3,
  legs: [leg()],
  placedAt: '2026-05-07T00:00:00.000Z',
  ...overrides,
});

const policy = (overrides: Partial<DfsBookPolicy> = {}): DfsBookPolicy =>
  defineBookPolicy({
    id: 'v4-book',
    displayName: 'V4 Book',
    version: '2026-05-test',
    effectiveFrom: '2026-05-01',
    status: 'draft',
    sources: [{ label: 'V4 hardening fixture' }],
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

describe('v4 strict validators', () => {
  test('validates canonical leg inputs and rejects legacy settlement fields', () => {
    expect(validateDfsLegInput(leg()).ok).toBe(true);

    const result = validateDfsLegInput({
      ...leg(),
      actual: Number.NaN,
      status: 'cancelled',
      stat: 12,
      legStatus: 'won',
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'validation.actual_finite',
        'validation.status_invalid',
        'validation.legacy_field',
      ]),
    );
    expect(result.errors.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['actual', 'status', 'stat', 'legStatus']),
    );
  });

  test('validates entries with structured issue paths and duplicate-leg detection', () => {
    const result = validateDfsEntryInput(
      entry({
        stake: -1,
        displayedMultiplier: Infinity,
        metadata: [] as unknown as Record<string, unknown>,
        legs: [
          leg({ legId: 'dup', line: Number.NaN }),
          leg({ legId: 'dup', playerName: '' }),
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'validation.stake_positive',
        'validation.displayed_multiplier_positive',
        'validation.metadata_object',
        'validation.duplicate_leg_id',
        'validation.line_finite',
        'validation.player_name_required',
      ]),
    );
    expect(() => assertValidDfsEntryInput(entry({ stake: 0 }))).toThrow(DfsEngineInvariantError);
  });

  test('validates settlement contexts and rejects legacy context aliases', () => {
    const result = validateDfsSettlementContext({
      actualsByLegId: { 'leg-1': Infinity },
      legStatusesByLegId: { 'leg-1': 'manual' },
      statsByLegId: { 'leg-1': 24 },
      legStatusByLegId: { 'leg-1': 'won' },
      settledAt: 'not-a-date',
      metadata: [] as unknown as Record<string, unknown>,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'validation.actual_finite',
        'validation.status_invalid',
        'validation.legacy_field',
        'validation.timestamp_invalid',
        'validation.metadata_object',
      ]),
    );
  });
});

describe('v4 definition and settlement hardening', () => {
  test('throws typed definition errors for invalid policy and payout definitions', () => {
    const validPolicy = policy();
    expect(() =>
      defineBookPolicy({
        ...validPolicy,
        status: 'beta' as DfsBookPolicy['status'],
      }),
    ).toThrow(DfsDefinitionError);
    expect(() =>
      defineBookPolicy({
        ...validPolicy,
        playTypes: [
          validPolicy.playTypes[0]!,
          {
            ...validPolicy.playTypes[0]!,
            displayName: 'Duplicate',
          },
        ],
      }),
    ).toThrow('duplicate play type');
    expect(() =>
      defineBookPolicy({
        ...validPolicy,
        playTypes: [
          {
            ...validPolicy.playTypes[0]!,
            pickCount: { min: 3, max: 2 },
          },
        ],
      }),
    ).toThrow('pickCount');
    expect(() =>
      definePayoutTable({
        bookId: 'v4-book',
        playTypeId: 'main',
        effectiveFrom: '2026-05-01',
        entries: [{ pickCount: 2, hits: 3, multiplier: 2 }],
      }),
    ).toThrow(DfsDefinitionError);
    expect(() =>
      definePayoutTable({
        bookId: 'v4-book',
        playTypeId: 'main',
        effectiveFrom: '2026-05-01',
        entries: [
          { pickCount: 2, hits: 2, multiplier: 3 },
          { pickCount: 2, hits: 2, multiplier: 4 },
        ],
      }),
    ).toThrow('duplicate payout row');
  });

  test('short-circuits invalid entries without saving money-moving settlements', async () => {
    const saveSettlement = vi.fn();
    const engine = createDfsEngine({
      bookPolicies: [policy()],
      settlementStore: { id: 'store', saveSettlement },
    });

    const result = await engine.settleEntry(
      entry({
        stake: 0,
        legs: [leg({ legId: 'dup' }), leg({ legId: 'dup' })],
      }),
    );

    expect(result.status).toBe('pending');
    expect(result.payout).toEqual({ total: 0, withdrawable: 0, bonus: 0 });
    expect(result.pendingReasons).toEqual(['validation_failed']);
    expect(result.validation.ok).toBe(false);
    expect(result.explanationCodes).toEqual(
      expect.arrayContaining(['validation.stake_positive', 'validation.duplicate_leg_id']),
    );
    expect(saveSettlement).not.toHaveBeenCalled();
  });

  test('reports provider, adapter, and provider-data contract failures explicitly', async () => {
    const invalidProvider = defineStatProvider({
      id: 'bad-provider',
      extractStat: () => ({ ok: true, actual: Number.NaN }),
    });
    const invalidAdapter = defineLeagueAdapter({
      league: 'SIM',
      adapters: {
        Points: () => Number.NaN,
      },
    });
    const engine = createDfsEngine({
      bookPolicies: [policy()],
      statProviders: [invalidProvider],
      leagueAdapters: [invalidAdapter],
    });

    await expect(
      engine.extractLegStat(leg(), { statProviderId: 'missing-provider' }, entry()),
    ).resolves.toMatchObject({
      ok: false,
      reason: 'provider_not_found',
    });
    await expect(
      engine.extractLegStat(leg(), { statProviderId: 'bad-provider' }, entry()),
    ).resolves.toMatchObject({
      ok: false,
      reason: 'invalid_provider_result',
    });
    await expect(
      engine.extractLegStat(leg({ league: 'SIM' }), { actualEntry: gameLogEntry() }, entry()),
    ).resolves.toMatchObject({
      ok: false,
      reason: 'invalid_adapter_result',
    });
    await expect(
      engine.extractLegStat(leg(), { actualEntry: { ...gameLogEntry(), points: null } }, entry()),
    ).resolves.toMatchObject({
      ok: false,
      reason: 'invalid_provider_data',
    });
  });

  test('guards payout invariants instead of returning impossible money math', async () => {
    const engine = createDfsEngine({
      bookPolicies: [
        policy({
          id: 'invalid-payout-book',
          payoutResolver: () => ({
            multiplier: Number.NaN,
            payout: { total: 10, withdrawable: 11, bonus: 0 },
          }),
          playTypes: [
            {
              id: 'main',
              displayName: 'Main',
              payoutModel: 'custom',
              pickCount: { min: 1, max: 1 },
            },
          ],
        }),
      ],
    });

    expect(() =>
      engine.lookupPayout({
        bookId: 'invalid-payout-book',
        playTypeId: 'main',
        stake: 10,
        pickCount: 1,
        hits: 2,
      }),
    ).toThrow(DfsEngineInvariantError);
    await expect(
      engine.settleEntry(entry({ bookId: 'invalid-payout-book' }), {
        actualsByLegId: { 'leg-1': 25 },
      }),
    ).rejects.toThrow(DfsEngineInvariantError);
    expect(() =>
      recalcMultiplierAfterDnp({
        app: 'prizepicks',
        playType: 'power',
        originalPickCount: 2.5,
        survivingPickCount: 2,
        survivingHits: 2,
        originalMultiplier: 3,
      }),
    ).toThrow(DfsEngineInvariantError);
  });
});
