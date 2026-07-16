import type {
  DfsEntryInput,
  DfsLegOutcome,
  DfsPolicyStatus,
  DfsPolicyVerificationStatus,
  DfsSettlementConfidence,
  PlayerGameLogEntryShape,
} from '@buzzr/dfs-engine';

export type ExpectedLegOutcome = {
  legId: string;
  status: DfsLegOutcome;
  actual: number | null;
  pendingReason: string | null;
  providerSource: string;
};

export type ExpectedSettlement = {
  status: 'won' | 'lost' | 'pushed' | 'pending' | 'void';
  multiplier: number;
  effectiveMultiplier: number;
  payout: { total: number; withdrawable: number; bonus: number };
  pendingReasons: string[];
  policyVersion: string | null;
  policyStatus: DfsPolicyStatus | null;
  policyVerificationStatus: DfsPolicyVerificationStatus | null;
  payoutTable: { version: string | null; effectiveFrom: string } | null;
  confidence: DfsSettlementConfidence;
  explanationCodes: string[];
  validation: { errorCodes: string[]; warningCodes: string[] };
  sourceLabels: string[];
  providerSources: string[];
  auditCodes: string[];
  legs: ExpectedLegOutcome[];
};

export type TestVector = {
  name: string;
  description: string;
  entry: DfsEntryInput;
  gameLogsByLegId: Record<string, PlayerGameLogEntryShape[]>;
  expected: ExpectedSettlement;
};

const NBA_GAME_DATE = '2026-07-16T20:00:00.000Z';
const PLACED_AT = '2026-07-16T12:00:00.000Z';

function nbaRow(overrides: Partial<PlayerGameLogEntryShape> = {}): PlayerGameLogEntryShape {
  return {
    date: NBA_GAME_DATE,
    minutes: '34:00',
    points: '0',
    rebounds: '0',
    assists: '0',
    steals: '0',
    blocks: '0',
    turnovers: '0',
    threeP: '0',
    ...overrides,
  };
}

function leg(
  index: number,
  overrides: Partial<DfsEntryInput['legs'][number]> = {},
): DfsEntryInput['legs'][number] {
  return {
    legId: `leg-${index}`,
    playerName: `Vector Player ${index}`,
    playerId: `athlete-${index}`,
    league: 'NBA',
    propType: 'Points',
    line: 20.5,
    direction: 'over',
    actual: null,
    status: 'pending',
    gameDate: NBA_GAME_DATE,
    ...overrides,
  };
}

type ExpectedBuilderInput = {
  status: ExpectedSettlement['status'];
  multiplier: number;
  payout?: ExpectedSettlement['payout'];
  pendingReasons?: string[];
  confidence?: DfsSettlementConfidence;
  explanationCodes: string[];
  validation?: ExpectedSettlement['validation'];
  legs: ExpectedLegOutcome[];
};

function expectedSettlement(
  profile: 'prizepicks' | 'underdog',
  input: ExpectedBuilderInput,
): ExpectedSettlement {
  const prizePicks = profile === 'prizepicks';
  return {
    status: input.status,
    multiplier: input.multiplier,
    effectiveMultiplier: input.multiplier,
    payout: input.payout ?? { total: 0, withdrawable: 0, bonus: 0 },
    pendingReasons: input.pendingReasons ?? [],
    policyVersion: '2026-05',
    policyStatus: 'experimental',
    policyVerificationStatus: prizePicks ? 'partial' : 'unverified',
    payoutTable: prizePicks
      ? { version: '2026-07-02-player-picks', effectiveFrom: '2026-07-02' }
      : { version: '2026-05', effectiveFrom: '2026-05-01' },
    confidence: input.confidence ?? (prizePicks ? 'medium' : 'low'),
    explanationCodes: input.explanationCodes,
    validation: input.validation ?? { errorCodes: [], warningCodes: [] },
    sourceLabels: prizePicks
      ? ['PrizePicks Payouts', 'PrizePicks Potential Outcomes']
      : ['Underdog Sports Legal Center'],
    providerSources: input.legs.map((item) => item.providerSource),
    auditCodes: ['settlement.started', 'settlement.policy_selected', `settlement.${input.status}`],
    legs: input.legs,
  };
}

export const TEST_VECTORS: readonly TestVector[] = [
  {
    name: 'prizepicks_power_2leg_all_win',
    description:
      'PrizePicks Power compatibility profile, two NBA Points overs both clear the line.',
    entry: {
      entryId: 'tv-power-2leg-won',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      placedAt: PLACED_AT,
      legs: [leg(1, { line: 20.5 }), leg(2, { line: 15.5 })],
    },
    gameLogsByLegId: {
      'leg-1': [nbaRow({ points: '28' })],
      'leg-2': [nbaRow({ points: '22' })],
    },
    expected: expectedSettlement('prizepicks', {
      status: 'won',
      multiplier: 3,
      payout: { total: 30, withdrawable: 30, bonus: 0 },
      explanationCodes: [
        'policy.status.experimental',
        'policy.verification.partial',
        'settlement.fixed_table_payout',
        'payout_table_lookup',
      ],
      legs: [
        {
          legId: 'leg-1',
          status: 'won',
          actual: 28,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
        {
          legId: 'leg-2',
          status: 'won',
          actual: 22,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
      ],
    }),
  },
  {
    name: 'prizepicks_power_2leg_one_loss',
    description: 'PrizePicks Power compatibility profile loses when one active leg misses.',
    entry: {
      entryId: 'tv-power-2leg-lost',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      placedAt: PLACED_AT,
      legs: [leg(1, { line: 20.5 }), leg(2, { propType: 'Rebounds', line: 7.5 })],
    },
    gameLogsByLegId: {
      'leg-1': [nbaRow({ points: '28' })],
      'leg-2': [nbaRow({ rebounds: '4' })],
    },
    expected: expectedSettlement('prizepicks', {
      status: 'lost',
      multiplier: 0,
      explanationCodes: [
        'policy.status.experimental',
        'policy.verification.partial',
        'settlement.all_or_nothing_loss',
        'payout_table_lookup',
      ],
      legs: [
        {
          legId: 'leg-1',
          status: 'won',
          actual: 28,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
        {
          legId: 'leg-2',
          status: 'lost',
          actual: 4,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
      ],
    }),
  },
  {
    name: 'underdog_standard_2leg_under_hits',
    description: 'Unverified Underdog Standard compatibility profile with two unders clearing.',
    entry: {
      entryId: 'tv-underdog-2leg-won',
      bookId: 'underdog',
      playTypeId: 'underdog_standard',
      stake: 5,
      displayedMultiplier: 3,
      placedAt: PLACED_AT,
      legs: [
        leg(1, { propType: 'Turnovers', line: 3.5, direction: 'under' }),
        leg(2, { propType: 'Assists', line: 8.5, direction: 'under' }),
      ],
    },
    gameLogsByLegId: {
      'leg-1': [nbaRow({ turnovers: '2' })],
      'leg-2': [nbaRow({ assists: '6' })],
    },
    expected: expectedSettlement('underdog', {
      status: 'won',
      multiplier: 3,
      payout: { total: 15, withdrawable: 15, bonus: 0 },
      explanationCodes: [
        'policy.status.experimental',
        'policy.verification.unverified',
        'settlement.fixed_table_payout',
        'payout_table_lookup',
      ],
      legs: [
        {
          legId: 'leg-1',
          status: 'won',
          actual: 2,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
        {
          legId: 'leg-2',
          status: 'won',
          actual: 6,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
      ],
    }),
  },
  {
    name: 'prizepicks_power_all_push_refund',
    description: 'Two exact-line ties remove every leg and return the stake as pushed.',
    entry: {
      entryId: 'tv-power-all-push',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      placedAt: PLACED_AT,
      legs: [leg(1, { line: 20 }), leg(2, { propType: 'Rebounds', line: 5 })],
    },
    gameLogsByLegId: {
      'leg-1': [nbaRow({ points: '20' })],
      'leg-2': [nbaRow({ rebounds: '5' })],
    },
    expected: expectedSettlement('prizepicks', {
      status: 'pushed',
      multiplier: 1,
      payout: { total: 10, withdrawable: 10, bonus: 0 },
      explanationCodes: [
        'policy.status.experimental',
        'policy.verification.partial',
        'leg.push_removed',
        'push_leg_removed',
        'settlement.all_legs_removed_refund',
        'refund_no_survivors',
      ],
      legs: [
        {
          legId: 'leg-1',
          status: 'push',
          actual: 20,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
        {
          legId: 'leg-2',
          status: 'push',
          actual: 5,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
      ],
    }),
  },
  {
    name: 'prizepicks_power_dnp_reprices_survivors',
    description: 'A ruled DNP is removed and the current three-pick entry reprices to two picks.',
    entry: {
      entryId: 'tv-power-dnp-reprice',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 6,
      placedAt: PLACED_AT,
      legs: [leg(1, { status: 'dnp' }), leg(2), leg(3)],
    },
    gameLogsByLegId: {
      'leg-2': [nbaRow({ points: '25' })],
      'leg-3': [nbaRow({ points: '24' })],
    },
    expected: expectedSettlement('prizepicks', {
      status: 'won',
      multiplier: 3,
      payout: { total: 30, withdrawable: 30, bonus: 0 },
      explanationCodes: [
        'policy.status.experimental',
        'policy.verification.partial',
        'leg.dnp',
        'dnp_leg_removed',
        'settlement.fixed_table_payout',
        'payout_table_lookup',
        'settlement.repriced_after_removed_legs',
      ],
      legs: [
        {
          legId: 'leg-1',
          status: 'dnp',
          actual: null,
          pendingReason: null,
          providerSource: 'status',
        },
        {
          legId: 'leg-2',
          status: 'won',
          actual: 25,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
        {
          legId: 'leg-3',
          status: 'won',
          actual: 24,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
      ],
    }),
  },
  {
    name: 'prizepicks_power_missing_supported_stat_pending',
    description: 'A valid NBA row with a missing supported Points value remains pending.',
    entry: {
      entryId: 'tv-power-missing-stat',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      placedAt: PLACED_AT,
      legs: [leg(1), leg(2)],
    },
    gameLogsByLegId: {
      'leg-1': [nbaRow({ points: '-' })],
      'leg-2': [nbaRow({ points: '25' })],
    },
    expected: expectedSettlement('prizepicks', {
      status: 'pending',
      multiplier: 0,
      pendingReasons: ['leg-1:missing_stat'],
      confidence: 'low',
      explanationCodes: [
        'policy.status.experimental',
        'policy.verification.partial',
        'leg.pending.missing_stat',
      ],
      legs: [
        {
          legId: 'leg-1',
          status: 'pending',
          actual: null,
          pendingReason: 'missing_stat',
          providerSource: 'vector-provider',
        },
        {
          legId: 'leg-2',
          status: 'won',
          actual: 25,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
      ],
    }),
  },
  {
    name: 'prizepicks_power_unsupported_prop_pending',
    description: 'A syntactically valid but unsupported prop is distinct from missing stat data.',
    entry: {
      entryId: 'tv-power-unsupported-prop',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      placedAt: PLACED_AT,
      legs: [leg(1, { propType: 'First Basket' }), leg(2)],
    },
    gameLogsByLegId: {
      'leg-1': [nbaRow()],
      'leg-2': [nbaRow({ points: '25' })],
    },
    expected: expectedSettlement('prizepicks', {
      status: 'pending',
      multiplier: 0,
      pendingReasons: ['leg-1:unsupported_prop'],
      confidence: 'low',
      explanationCodes: [
        'policy.status.experimental',
        'policy.verification.partial',
        'leg.pending.unsupported_prop',
      ],
      legs: [
        {
          legId: 'leg-1',
          status: 'pending',
          actual: null,
          pendingReason: 'unsupported_prop',
          providerSource: 'vector-provider',
        },
        {
          legId: 'leg-2',
          status: 'won',
          actual: 25,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
      ],
    }),
  },
  {
    name: 'prizepicks_flex_duplicate_player_warning',
    description: 'Duplicate player selections settle but preserve a policy validation warning.',
    entry: {
      entryId: 'tv-flex-duplicate-warning',
      bookId: 'prizepicks',
      playTypeId: 'flex',
      stake: 10,
      displayedMultiplier: 3,
      placedAt: PLACED_AT,
      legs: [
        leg(1, { playerId: 'duplicate-athlete' }),
        leg(2, { playerId: 'duplicate-athlete', propType: 'Rebounds', line: 5.5 }),
        leg(3, { propType: 'Assists', line: 6.5 }),
      ],
    },
    gameLogsByLegId: {
      'leg-1': [nbaRow({ points: '25' })],
      'leg-2': [nbaRow({ rebounds: '8' })],
      'leg-3': [nbaRow({ assists: '9' })],
    },
    expected: expectedSettlement('prizepicks', {
      status: 'won',
      multiplier: 3,
      payout: { total: 30, withdrawable: 30, bonus: 0 },
      explanationCodes: [
        'validation.duplicate_player',
        'policy.status.experimental',
        'policy.verification.partial',
        'settlement.fixed_table_payout',
        'payout_table_lookup',
      ],
      validation: { errorCodes: [], warningCodes: ['validation.duplicate_player'] },
      legs: [
        {
          legId: 'leg-1',
          status: 'won',
          actual: 25,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
        {
          legId: 'leg-2',
          status: 'won',
          actual: 8,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
        {
          legId: 'leg-3',
          status: 'won',
          actual: 9,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
      ],
    }),
  },
  {
    name: 'prizepicks_power_wrong_date_provider_row_pending',
    description: 'A valid player row outside the game-date window is not silently selected.',
    entry: {
      entryId: 'tv-power-wrong-date',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      placedAt: PLACED_AT,
      legs: [leg(1), leg(2)],
    },
    gameLogsByLegId: {
      'leg-1': [nbaRow({ date: '2026-07-12T20:00:00.000Z', points: '40' })],
      'leg-2': [nbaRow({ points: '25' })],
    },
    expected: expectedSettlement('prizepicks', {
      status: 'pending',
      multiplier: 0,
      pendingReasons: ['leg-1:missing_provider_data'],
      confidence: 'low',
      explanationCodes: [
        'policy.status.experimental',
        'policy.verification.partial',
        'leg.pending.missing_provider_data',
      ],
      legs: [
        {
          legId: 'leg-1',
          status: 'pending',
          actual: null,
          pendingReason: 'missing_provider_data',
          providerSource: 'vector-provider',
        },
        {
          legId: 'leg-2',
          status: 'won',
          actual: 25,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
      ],
    }),
  },
  {
    name: 'prizepicks_power_ambiguous_same_day_rows_pending',
    description: 'Two plausible same-day rows surface ambiguity instead of choosing one silently.',
    entry: {
      entryId: 'tv-power-ambiguous-rows',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      placedAt: PLACED_AT,
      legs: [leg(1), leg(2)],
    },
    gameLogsByLegId: {
      'leg-1': [
        nbaRow({ date: '2026-07-16T13:00:00.000Z', points: '18' }),
        nbaRow({ date: '2026-07-16T17:00:00.000Z', points: '28' }),
      ],
      'leg-2': [nbaRow({ points: '25' })],
    },
    expected: expectedSettlement('prizepicks', {
      status: 'pending',
      multiplier: 0,
      pendingReasons: ['leg-1:missing_provider_data'],
      confidence: 'low',
      explanationCodes: [
        'policy.status.experimental',
        'policy.verification.partial',
        'leg.pending.missing_provider_data',
      ],
      legs: [
        {
          legId: 'leg-1',
          status: 'pending',
          actual: null,
          pendingReason: 'missing_provider_data',
          providerSource: 'vector-provider',
        },
        {
          legId: 'leg-2',
          status: 'won',
          actual: 25,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
      ],
    }),
  },
  {
    name: 'prizepicks_power_current_3leg_payout',
    description: 'The July 2, 2026 standard three-pick Power table resolves at 6x.',
    entry: {
      entryId: 'tv-power-current-3leg',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 6,
      placedAt: PLACED_AT,
      legs: [leg(1), leg(2), leg(3)],
    },
    gameLogsByLegId: {
      'leg-1': [nbaRow({ points: '25' })],
      'leg-2': [nbaRow({ points: '24' })],
      'leg-3': [nbaRow({ points: '23' })],
    },
    expected: expectedSettlement('prizepicks', {
      status: 'won',
      multiplier: 6,
      payout: { total: 60, withdrawable: 60, bonus: 0 },
      explanationCodes: [
        'policy.status.experimental',
        'policy.verification.partial',
        'settlement.fixed_table_payout',
        'payout_table_lookup',
      ],
      legs: [
        {
          legId: 'leg-1',
          status: 'won',
          actual: 25,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
        {
          legId: 'leg-2',
          status: 'won',
          actual: 24,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
        {
          legId: 'leg-3',
          status: 'won',
          actual: 23,
          pendingReason: null,
          providerSource: 'stat-provider',
        },
      ],
    }),
  },
];
