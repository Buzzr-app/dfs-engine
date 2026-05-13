import { describe, expect, test } from 'vitest';
import {
  adaptBuzzrBetInput,
  createDfsEngine,
  defineLeagueAdapter,
  defineStatProvider,
  type DfsEntryInput,
  type DfsLegInput,
  type PlayerGameLogEntryShape,
} from '../src';
import type { CreateDfsBetInput, DfsBetLeg } from '../src';

const gameLogEntry = (
  overrides: Partial<PlayerGameLogEntryShape> = {},
): PlayerGameLogEntryShape => ({
  date: '2026-05-07T00:00:00.000Z',
  minutes: '34:12',
  points: '26',
  rebounds: '8',
  assists: '6',
  steals: '1',
  blocks: '0',
  turnovers: '2',
  threeP: '4',
  ...overrides,
});

const leg = (overrides: Partial<DfsLegInput> = {}): DfsLegInput => ({
  legId: 'leg-1',
  playerName: 'A. Example',
  league: 'NBA',
  propType: 'Points',
  line: 20.5,
  direction: 'over',
  gameDate: '2026-05-07T00:00:00.000Z',
  ...overrides,
});

const entry = (overrides: Partial<DfsEntryInput> = {}): DfsEntryInput => ({
  entryId: 'entry-1',
  bookId: 'prizepicks',
  playTypeId: 'power',
  stake: 10,
  displayedMultiplier: 3,
  legs: [leg(), leg({ legId: 'leg-2', propType: 'Rebounds', line: 7.5 })],
  ...overrides,
});

describe('v2 Settlement OS engine', () => {
  test('settles a complete entry with per-leg decisions, payout split, provenance, and audit trail', async () => {
    const engine = createDfsEngine({
      clock: () => new Date('2026-05-08T04:00:00.000Z'),
    });

    const result = await engine.settleEntry(entry(), {
      actualsByLegId: {
        'leg-1': 26,
        'leg-2': 8,
      },
      auditRunId: 'settle-run-1',
    });

    expect(result.status).toBe('won');
    expect(result.effectiveMultiplier).toBe(3);
    expect(result.payout).toEqual({ total: 30, withdrawable: 30, bonus: 0 });
    expect(result.legs.map((decision) => decision.status)).toEqual(['won', 'won']);
    expect(result.legs[0]?.actual).toBe(26);
    expect(result.legs[0]?.provider).toMatchObject({
      source: 'context',
    });
    expect(result.auditTrail.map((event) => event.code)).toContain('settlement.won');
    expect(result.policyVersion).toBe('2026-05');
    expect(engine.explainSettlement(result)).toContain('entry-1 settled as won');
    expect(engine.explainSettlement(result)).toContain('3x');
  });

  test('extracts stats through an optional provider plugin when context actuals are absent', async () => {
    const provider = defineStatProvider({
      id: 'fixture-gamelog',
      async getGameLog({ leg: requestedLeg }) {
        expect(requestedLeg.legId).toBe('leg-1');
        return [gameLogEntry({ points: '31' })];
      },
    });
    const engine = createDfsEngine({ statProviders: [provider] });

    const result = await engine.extractLegStat(
      leg(),
      {
        statProviderId: 'fixture-gamelog',
      },
      entry({ legs: [leg()] }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: 31,
      provenance: {
        source: 'stat-provider',
        providerId: 'fixture-gamelog',
      },
    });
  });

  test('keeps league registries isolated per engine instance', async () => {
    const customLeague = defineLeagueAdapter({
      league: 'SIM',
      adapters: {
        Points: () => 42,
      },
    });
    const engineWithSim = createDfsEngine({ leagueAdapters: [customLeague] });
    const defaultEngine = createDfsEngine();
    const simLeg = leg({ league: 'SIM' });

    await expect(
      engineWithSim.extractLegStat(simLeg, {
        actualEntry: gameLogEntry(),
      }),
    ).resolves.toMatchObject({ ok: true, value: 42 });
    await expect(
      defaultEngine.extractLegStat(simLeg, {
        actualEntry: gameLogEntry(),
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'unsupported_prop' });
  });

  test('voids and refunds an entry when policy removes every leg as DNP', async () => {
    const engine = createDfsEngine();
    const result = await engine.settleEntry(
      entry({
        stake: 25,
        legs: [leg({ legStatus: 'dnp' })],
      }),
    );

    expect(result.status).toBe('void');
    expect(result.payout).toEqual({ total: 25, withdrawable: 25, bonus: 0 });
    expect(result.adjustments).toContainEqual(expect.objectContaining({ type: 'void' }));
  });

  test('prices boosted Underdog flex payouts against the surviving hit count', async () => {
    const engine = createDfsEngine();
    const result = await engine.settleEntry(
      entry({
        bookId: 'underdog',
        playTypeId: 'underdog_flex',
        displayedMultiplier: 11.5,
        baseMultiplier: 10,
        stake: 10,
        legs: [
          leg({ legId: 'a', line: 10.5 }),
          leg({ legId: 'b', line: 10.5 }),
          leg({ legId: 'c', line: 10.5 }),
          leg({ legId: 'd', line: 10.5 }),
          leg({ legId: 'e', line: 10.5 }),
        ],
      }),
      {
        actualsByLegId: {
          a: 12,
          b: 12,
          c: 12,
          d: 12,
          e: 9,
        },
      },
    );

    expect(result.status).toBe('won');
    expect(result.effectiveMultiplier).toBe(2.3);
    expect(result.payout).toEqual({ total: 23, withdrawable: 20, bonus: 3 });
  });

  test('adapts the current Buzzr DfsBetLeg shape into the lean v2 entry model', () => {
    const buzzrLeg: DfsBetLeg = {
      legId: 'buzzr-leg',
      playerName: 'Buzzr Player',
      playerTeam: 'NYK',
      playerPosition: null,
      playerNumber: null,
      playerAthleteId: 'athlete-1',
      linkage: null,
      propType: '3PT Made',
      line: 2.5,
      direction: 'over',
      league: 'NBA',
      gameContext: {
        raw: 'NYK @ BOS Thu 7pm',
        homeTeam: 'BOS',
        awayTeam: 'NYK',
        homeScore: null,
        awayScore: null,
        state: 'pre',
        clock: null,
        startTime: '7pm',
        gameId: 'game-1',
        gameDate: '2026-05-07',
        gameStartTime: '19:00',
        dayOfWeek: 'Thu',
        stateCode: 'NY',
      },
      actualValue: null,
      legStatus: 'pending',
      boostType: 'standard',
      liveSnapshot: null,
      gradingSnapshot: null,
    };
    const buzzrInput: CreateDfsBetInput = {
      userId: 'user-1',
      app: 'prizepicks',
      playType: 'power',
      multiplier: 3,
      baseMultiplier: 3,
      stakeAmount: 10,
      legs: [buzzrLeg],
      source: 'manual',
    };

    expect(adaptBuzzrBetInput(buzzrInput)).toMatchObject({
      entryId: 'user-1:draft',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      baseMultiplier: 3,
      legs: [
        {
          legId: 'buzzr-leg',
          playerId: 'athlete-1',
          propType: '3-Pointers Made',
          gameId: 'game-1',
          gameDate: '2026-05-07',
        },
      ],
    });
  });
});
