import { computeBoostSplit, extractStatForProp, gradeLegFromActual } from './grading';
import type { BetStatus, PlayerGameLogEntryShape } from './grading';
import { normalizeDfsPropType } from './prop-normalizer';
import type {
  CreateDfsBetInput,
  DfsApp,
  DfsBetLeg,
  DfsLegStatus,
  DfsPayoutSplit,
  DfsPlayType,
} from './types';

export type Clock = () => Date;

export type BuiltInBookId = 'prizepicks' | 'underdog';
export type DfsBookId = BuiltInBookId | string;
export type DfsPlayTypeId = string;
export type DfsPolicyStatus = 'stable' | 'draft' | 'experimental';
export type DfsPayoutModel = 'fixed-table' | 'displayed-multiplier' | 'custom';
export type DfsSettlementConfidence = 'high' | 'medium' | 'low';
export type DfsValidationSeverity = 'allow' | 'warn' | 'error';
export type DfsLegOutcome = DfsLegStatus | 'void' | 'rescued' | 'canceled' | 'manual';

export type DfsBookSourceRef = {
  label: string;
  url?: string;
  retrievedAt?: string;
  note?: string;
};

export type DfsBookPlayType = {
  id: DfsPlayTypeId;
  displayName: string;
  payoutModel: DfsPayoutModel;
  pickCount: {
    min: number;
    max: number;
  };
  allOrNothing?: boolean;
  flex?: boolean;
  scaleDisplayedMultiplier?: boolean;
};

export type DfsTiePolicy =
  | { type: 'push' }
  | { type: 'more_wins_less_loses' }
  | { type: 'loss' }
  | {
      type: 'custom';
      gradeTie: (input: {
        leg: DfsLegInput;
        entry: DfsEntryInput;
        context: DfsSettlementContext;
      }) => DfsLegOutcome;
    };

export type DfsDnpPolicy =
  | { type: 'remove_leg'; voidIfNoSurvivors?: boolean }
  | { type: 'loss' }
  | { type: 'manual'; reasonCode?: string }
  | {
      type: 'custom';
      resolve: (input: {
        leg: DfsLegInput;
        entry: DfsEntryInput;
        context: DfsSettlementContext;
      }) => DfsLegOutcome;
    };

export type DfsPushPolicy =
  | { type: 'remove_leg'; refundIfNoSurvivors?: boolean }
  | { type: 'loss' }
  | { type: 'manual'; reasonCode?: string }
  | {
      type: 'custom';
      resolve: (input: {
        leg: DfsLegInput;
        entry: DfsEntryInput;
        context: DfsSettlementContext;
      }) => DfsLegOutcome;
    };

export type DfsRescuePolicy =
  | { type: 'none' }
  | { type: 'void_entry' }
  | { type: 'remove_leg' }
  | {
      type: 'custom';
      resolve: (input: {
        leg: DfsLegInput;
        entry: DfsEntryInput;
        context: DfsSettlementContext;
      }) => DfsLegOutcome;
    };

export type DfsPayoutSplitStrategy =
  | { type: 'all_withdrawable' }
  | { type: 'underdog_bonus_split' }
  | {
      type: 'custom';
      split: (input: {
        stake: number;
        multiplier: number;
        totalPayout: number;
        baseMultiplier?: number | null;
        profitBoostPct?: number | null;
      }) => DfsPayoutSplit;
    };

export type DfsBookValidationRules = {
  duplicatePlayers?: DfsValidationSeverity;
  sameTeam?: DfsValidationSeverity;
  sameGame?: DfsValidationSeverity;
  leagues?: readonly string[];
};

export type DfsValidationIssue = {
  code: string;
  message: string;
  severity: 'warning' | 'error';
  legIds?: string[];
};

export type DfsValidationResult = {
  ok: boolean;
  errors: DfsValidationIssue[];
  warnings: DfsValidationIssue[];
};

export type DfsPayoutResolverInput = {
  bookId: DfsBookId;
  playTypeId: DfsPlayTypeId;
  stake: number;
  displayedMultiplier?: number | null;
  baseMultiplier?: number | null;
  profitBoostPct?: number | null;
  pickCount: number;
  hits: number;
  losses: number;
  pushes: number;
  removedCount: number;
  entry: DfsEntryInput;
  decisions: readonly DfsLegDecision[];
};

export type DfsPayoutResolverResult = {
  multiplier: number;
  payout?: DfsPayoutSplit;
  explanationCode?: string;
  confidence?: DfsSettlementConfidence;
};

export type DfsPayoutResolution = {
  status: BetStatus;
  multiplier: number;
  payout: DfsPayoutSplit;
  explanationCode: string;
  confidence: DfsSettlementConfidence;
};

export type DfsBookPolicy = {
  id: DfsBookId;
  displayName: string;
  version: string;
  effectiveFrom: string;
  status: DfsPolicyStatus;
  sources: readonly DfsBookSourceRef[];
  playTypes: readonly DfsBookPlayType[];
  tiePolicy: DfsTiePolicy;
  dnpPolicy: DfsDnpPolicy;
  pushPolicy: DfsPushPolicy;
  rescuePolicy?: DfsRescuePolicy;
  payoutSplit: DfsPayoutSplitStrategy;
  validation?: DfsBookValidationRules;
  payoutResolver?: (input: DfsPayoutResolverInput) => DfsPayoutResolverResult;
};

export type DfsPayoutTableEntry = {
  picks?: number;
  pickCount?: number;
  hits: number;
  multiplier: number;
};

export type DfsPayoutTableDefinition = {
  bookId: DfsBookId;
  playTypeId: DfsPlayTypeId;
  version?: string;
  effectiveFrom: string;
  sourceNotes?: readonly string[];
  entries: readonly DfsPayoutTableEntry[];
};

export type StatProviderRequest = {
  leg: DfsLegInput;
  context: DfsSettlementContext;
};

export type StatProviderResult =
  | {
      ok: true;
      actual: number;
      source?: string;
      sourceRef?: string;
      observedAt?: string;
      confidence?: number;
      raw?: unknown;
    }
  | {
      ok: false;
      reason: DfsLegStatFailureReason;
      source?: string;
      sourceRef?: string;
      observedAt?: string;
      raw?: unknown;
    };

export interface StatProvider {
  readonly id: string;
  extractStat?(request: StatProviderRequest): Promise<StatProviderResult> | StatProviderResult;
  getGameLog?(
    request: StatProviderGameLogInput,
  ): Promise<PlayerGameLogEntryShape[]> | PlayerGameLogEntryShape[];
}

export type StatProviderGameLogInput = {
  leg: DfsLegInput;
  entry: DfsEntryInput;
  context: DfsSettlementContext;
};

export type StatProviderActualInput = StatProviderRequest;

export type GameProviderRequest = {
  leg: DfsLegInput;
  context: DfsSettlementContext;
};

export type GameProviderResult =
  | {
      ok: true;
      gameId?: string;
      gameDate?: string;
      startedAt?: string;
      status?: string;
      source?: string;
      raw?: unknown;
    }
  | {
      ok: false;
      reason: string;
      source?: string;
      raw?: unknown;
    };

export interface GameProvider {
  readonly id: string;
  resolveGame(request: GameProviderRequest): Promise<GameProviderResult> | GameProviderResult;
}

export type PlayerResolverRequest = {
  leg: DfsLegInput;
  context: DfsSettlementContext;
};

export type PlayerResolverResult =
  | { ok: true; playerId: string; source?: string; raw?: unknown }
  | { ok: false; reason: string; source?: string; raw?: unknown };

export interface PlayerResolver {
  readonly id: string;
  resolvePlayer(
    request: PlayerResolverRequest,
  ): Promise<PlayerResolverResult> | PlayerResolverResult;
}

export interface SettlementStore {
  readonly id: string;
  saveSettlement?(
    result: DfsSettlementResult,
  ): Promise<void | { revision?: string }> | void | { revision?: string };
  loadSettlement?(
    entryId: string,
  ): Promise<DfsSettlementResult | null> | DfsSettlementResult | null;
}

export type DfsEngineAuditMetadata = {
  engineVersion?: string;
  releaseChannel?: string;
  environment?: string;
  tags?: readonly string[];
  [key: string]: unknown;
};

export type DfsEngineConfig = {
  bookPolicies?: readonly DfsBookPolicy[];
  payoutTables?: readonly DfsPayoutTableDefinition[];
  leagueAdapters?: readonly DfsLeagueAdapterDefinition[];
  statProviders?: readonly StatProvider[];
  gameProviders?: readonly GameProvider[];
  playerResolvers?: readonly PlayerResolver[];
  settlementStore?: SettlementStore;
  clock?: Clock;
  audit?: DfsEngineAuditMetadata;
};

export type DfsLegInput = {
  legId: string;
  playerId?: string | null;
  playerName: string;
  team?: string | null;
  opponent?: string | null;
  gameId?: string | null;
  gameDate?: string | null;
  league: string;
  propType: string;
  line: number;
  direction: 'over' | 'under';
  stat?: number | null;
  status?: DfsLegOutcome | 'dnp' | null;
  legStatus?: DfsLegOutcome | 'dnp' | null;
  providerData?: PlayerGameLogEntryShape | null;
  metadata?: Record<string, unknown>;
};

export type DfsEntryInput = {
  entryId: string;
  bookId: DfsBookId;
  playTypeId: DfsPlayTypeId;
  stake: number;
  displayedMultiplier: number;
  baseMultiplier?: number | null;
  profitBoostPct?: number | null;
  legs: readonly DfsLegInput[];
  placedAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type DfsV2EntryInput = Omit<DfsEntryInput, 'bookId' | 'playTypeId'> & {
  app: DfsApp | string;
  playType: DfsPlayType | string;
};

export type DfsSettlementContext = {
  settledAt?: string;
  statsByLegId?: Record<string, number | null | undefined>;
  actualsByLegId?: Record<string, number | null | undefined>;
  legStatusesByLegId?: Record<string, DfsLegOutcome | 'dnp' | null | undefined>;
  legStatusByLegId?: Record<string, DfsLegOutcome | 'dnp' | null | undefined>;
  providerDataByLegId?: Record<string, PlayerGameLogEntryShape | null | undefined>;
  actualEntry?: PlayerGameLogEntryShape | null;
  providerId?: string;
  statProviderId?: string;
  auditId?: string;
  auditRunId?: string;
  metadata?: Record<string, unknown>;
};

export type DfsLegStatFailureReason =
  | 'missing_provider_data'
  | 'missing_stat'
  | 'unsupported_prop'
  | 'provider_error';

export type DfsLegStatResult =
  | {
      ok: true;
      actual: number;
      value: number;
      source: 'input' | 'context' | 'provider_data' | 'stat_provider';
      providerId?: string;
      provenance: DfsProviderProvenance;
    }
  | {
      ok: false;
      reason: DfsLegStatFailureReason;
      source: 'input' | 'context' | 'provider_data' | 'stat_provider';
      providerId?: string;
      provenance: DfsProviderProvenance;
    };

export type DfsProviderProvenance = {
  source: string;
  providerId?: string | null;
  sourceRef?: string;
  observedAt?: string;
  confidence?: number;
  raw?: unknown;
};

export type DfsLegDecision = {
  legId: string;
  status: DfsLegOutcome;
  actual: number | null;
  line: number;
  direction: 'over' | 'under';
  playerName: string;
  propType: string;
  provider: DfsProviderProvenance;
  pendingReason?: DfsLegStatFailureReason | null;
};

export type DfsSettlementAdjustment = {
  type: 'dnp' | 'push' | 'void' | 'rescued' | 'canceled' | 'manual';
  legId?: string;
  message: string;
};

export type DfsSettlementResult = {
  entryId: string;
  bookId: DfsBookId;
  playTypeId: DfsPlayTypeId;
  status: BetStatus;
  multiplier: number;
  effectiveMultiplier: number;
  payout: DfsPayoutSplit;
  stake: number;
  displayedMultiplier: number;
  baseMultiplier?: number | null;
  profitBoostPct?: number | null;
  legs: DfsLegDecision[];
  adjustments: DfsSettlementAdjustment[];
  pendingReasons: string[];
  policyVersion: string | null;
  sourceRefs: DfsBookSourceRef[];
  confidence: DfsSettlementConfidence;
  explanationCodes: string[];
  provenance: {
    providers: DfsProviderProvenance[];
    settledAt: string;
    auditId?: string;
  };
  auditTrail: Array<{
    at: string;
    code: string;
    message: string;
    metadata?: Record<string, unknown>;
  }>;
};

export type DfsLeagueAdapterDefinition = {
  league: string;
  propAliases?: Record<string, string>;
  adapters?: Record<string, (entry: PlayerGameLogEntryShape, leg: DfsLegInput) => number | null>;
};

export interface DfsEngine {
  normalizeEntry(input: DfsEntryInput): DfsEntryInput;
  extractLegStat(
    leg: DfsLegInput,
    context?: DfsSettlementContext,
    entry?: DfsEntryInput,
  ): Promise<DfsLegStatResult>;
  gradeLeg(leg: DfsLegInput, actual: number, entry?: DfsEntryInput): DfsLegOutcome;
  lookupPayout(input: DfsPayoutLookupInput): DfsPayoutResolution | null;
  validateEntry(input: DfsEntryInput): DfsValidationResult;
  settleEntry(input: DfsEntryInput, context?: DfsSettlementContext): Promise<DfsSettlementResult>;
  explainSettlement(result: DfsSettlementResult): string;
  registerBookPolicy(policy: DfsBookPolicy): void;
  registerPayoutTable(table: DfsPayoutTableDefinition): void;
  registerLeagueAdapter(adapter: DfsLeagueAdapterDefinition): void;
  registerStatProvider(provider: StatProvider): void;
  getRegisteredBooks(): DfsBookId[];
}

export type DfsPayoutLookupInput = {
  bookId: DfsBookId;
  playTypeId: DfsPlayTypeId;
  stake: number;
  displayedMultiplier?: number | null;
  baseMultiplier?: number | null;
  profitBoostPct?: number | null;
  pickCount: number;
  hits: number;
  losses?: number;
  pushes?: number;
  removedCount?: number;
  entry?: DfsEntryInput;
  decisions?: readonly DfsLegDecision[];
};

const EMPTY_PAYOUT: DfsPayoutSplit = { total: 0, withdrawable: 0, bonus: 0 };

const PRIZEPICKS_POWER: readonly DfsPayoutTableEntry[] = [
  { picks: 2, hits: 2, multiplier: 3 },
  { picks: 3, hits: 3, multiplier: 5 },
  { picks: 4, hits: 4, multiplier: 10 },
  { picks: 5, hits: 5, multiplier: 20 },
  { picks: 6, hits: 6, multiplier: 37.5 },
];

const PRIZEPICKS_FLEX: readonly DfsPayoutTableEntry[] = [
  { picks: 3, hits: 3, multiplier: 2.25 },
  { picks: 3, hits: 2, multiplier: 1.25 },
  { picks: 4, hits: 4, multiplier: 5 },
  { picks: 4, hits: 3, multiplier: 1.5 },
  { picks: 5, hits: 5, multiplier: 10 },
  { picks: 5, hits: 4, multiplier: 2 },
  { picks: 5, hits: 3, multiplier: 0.4 },
  { picks: 6, hits: 6, multiplier: 25 },
  { picks: 6, hits: 5, multiplier: 1.75 },
  { picks: 6, hits: 4, multiplier: 0.4 },
];

const UNDERDOG_STANDARD: readonly DfsPayoutTableEntry[] = [
  { picks: 2, hits: 2, multiplier: 3 },
  { picks: 3, hits: 3, multiplier: 6 },
  { picks: 4, hits: 4, multiplier: 10 },
  { picks: 5, hits: 5, multiplier: 20 },
  { picks: 6, hits: 6, multiplier: 35 },
  { picks: 7, hits: 7, multiplier: 60 },
  { picks: 8, hits: 8, multiplier: 100 },
];

const UNDERDOG_FLEX: readonly DfsPayoutTableEntry[] = [
  { picks: 3, hits: 3, multiplier: 2.25 },
  { picks: 3, hits: 2, multiplier: 1.25 },
  { picks: 4, hits: 4, multiplier: 6 },
  { picks: 4, hits: 3, multiplier: 1.5 },
  { picks: 5, hits: 5, multiplier: 10 },
  { picks: 5, hits: 4, multiplier: 2 },
  { picks: 5, hits: 3, multiplier: 0.4 },
  { picks: 6, hits: 6, multiplier: 25 },
  { picks: 6, hits: 5, multiplier: 2 },
  { picks: 6, hits: 4, multiplier: 0.4 },
  { picks: 7, hits: 7, multiplier: 50 },
  { picks: 7, hits: 6, multiplier: 5 },
  { picks: 7, hits: 5, multiplier: 1.5 },
  { picks: 8, hits: 8, multiplier: 80 },
  { picks: 8, hits: 7, multiplier: 10 },
  { picks: 8, hits: 6, multiplier: 2 },
];

const BUILT_IN_SOURCES: Record<BuiltInBookId, readonly DfsBookSourceRef[]> = {
  prizepicks: [
    {
      label: 'PrizePicks payout and settlement compatibility profile',
      note: 'Stable built-in profile matching @buzzr/dfs-engine v2 behavior.',
    },
  ],
  underdog: [
    {
      label: 'Underdog payout and settlement compatibility profile',
      note: 'Stable built-in profile matching @buzzr/dfs-engine v2 behavior.',
    },
  ],
};

const DEFAULT_PAYOUT_TABLES: readonly DfsPayoutTableDefinition[] = [
  {
    bookId: 'prizepicks',
    playTypeId: 'power',
    version: '2026-05',
    effectiveFrom: '2026-05-01',
    entries: PRIZEPICKS_POWER,
  },
  {
    bookId: 'prizepicks',
    playTypeId: 'flex',
    version: '2026-05',
    effectiveFrom: '2026-05-01',
    entries: PRIZEPICKS_FLEX,
  },
  {
    bookId: 'underdog',
    playTypeId: 'underdog_standard',
    version: '2026-05',
    effectiveFrom: '2026-05-01',
    entries: UNDERDOG_STANDARD,
  },
  {
    bookId: 'underdog',
    playTypeId: 'underdog_flex',
    version: '2026-05',
    effectiveFrom: '2026-05-01',
    entries: UNDERDOG_FLEX,
  },
];

const DEFAULT_BOOK_POLICIES: readonly DfsBookPolicy[] = [
  defineBookPolicy({
    id: 'prizepicks',
    displayName: 'PrizePicks',
    version: '2026-05',
    effectiveFrom: '2026-05-01',
    status: 'stable',
    sources: BUILT_IN_SOURCES.prizepicks,
    playTypes: [
      {
        id: 'power',
        displayName: 'Power Play',
        payoutModel: 'fixed-table',
        pickCount: { min: 2, max: 6 },
        allOrNothing: true,
        scaleDisplayedMultiplier: true,
      },
      {
        id: 'flex',
        displayName: 'Flex Play',
        payoutModel: 'fixed-table',
        pickCount: { min: 3, max: 6 },
        flex: true,
        scaleDisplayedMultiplier: true,
      },
    ],
    tiePolicy: { type: 'push' },
    dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
    pushPolicy: { type: 'remove_leg', refundIfNoSurvivors: true },
    payoutSplit: { type: 'all_withdrawable' },
    validation: {
      duplicatePlayers: 'warn',
      sameTeam: 'allow',
      sameGame: 'allow',
    },
  }),
  defineBookPolicy({
    id: 'underdog',
    displayName: 'Underdog',
    version: '2026-05',
    effectiveFrom: '2026-05-01',
    status: 'stable',
    sources: BUILT_IN_SOURCES.underdog,
    playTypes: [
      {
        id: 'underdog_standard',
        displayName: 'Standard',
        payoutModel: 'fixed-table',
        pickCount: { min: 2, max: 8 },
        allOrNothing: true,
        scaleDisplayedMultiplier: true,
      },
      {
        id: 'underdog_flex',
        displayName: 'Flex',
        payoutModel: 'fixed-table',
        pickCount: { min: 3, max: 8 },
        flex: true,
        scaleDisplayedMultiplier: true,
      },
    ],
    tiePolicy: { type: 'push' },
    dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
    pushPolicy: { type: 'remove_leg', refundIfNoSurvivors: true },
    payoutSplit: { type: 'underdog_bonus_split' },
    validation: {
      duplicatePlayers: 'warn',
      sameTeam: 'allow',
      sameGame: 'allow',
    },
  }),
];

export const DRAFT_BOOK_POLICY_FIXTURES: readonly DfsBookPolicy[] = [
  defineBookPolicy({
    id: 'sleeper',
    displayName: 'Sleeper',
    version: 'draft-2026-05',
    effectiveFrom: '2026-05-01',
    status: 'draft',
    sources: [
      {
        label: 'Sleeper Over/Under rules',
        url: 'https://support.sleeper.com/en/articles/5556096-over-under-rules',
        note: 'Draft fixture only; not registered by default.',
      },
    ],
    playTypes: [
      {
        id: 'over_under',
        displayName: 'Over/Under',
        payoutModel: 'displayed-multiplier',
        pickCount: { min: 2, max: 8 },
        scaleDisplayedMultiplier: true,
      },
    ],
    tiePolicy: { type: 'push' },
    dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
    pushPolicy: { type: 'remove_leg', refundIfNoSurvivors: true },
    payoutSplit: { type: 'all_withdrawable' },
    validation: { duplicatePlayers: 'warn', sameTeam: 'allow', sameGame: 'allow' },
  }),
  defineBookPolicy({
    id: 'dabble',
    displayName: 'Dabble',
    version: 'draft-2026-05',
    effectiveFrom: '2026-05-01',
    status: 'draft',
    sources: [
      {
        label: 'Dabble void recalculation rules',
        url: 'https://helpdesk.dabble.com/en/articles/12124970-how-does-dabble-calculate-payouts-when-picks-are-voided-or-adjusted',
        note: 'Draft fixture only; not registered by default.',
      },
    ],
    playTypes: [
      {
        id: 'pick_em',
        displayName: 'Pick Em',
        payoutModel: 'displayed-multiplier',
        pickCount: { min: 2, max: 10 },
        scaleDisplayedMultiplier: true,
      },
    ],
    tiePolicy: { type: 'push' },
    dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
    pushPolicy: { type: 'remove_leg', refundIfNoSurvivors: true },
    payoutSplit: { type: 'all_withdrawable' },
    validation: { duplicatePlayers: 'warn', sameTeam: 'allow', sameGame: 'allow' },
  }),
  defineBookPolicy({
    id: 'parlayplay',
    displayName: 'ParlayPlay',
    version: 'draft-2026-05',
    effectiveFrom: '2026-05-01',
    status: 'draft',
    sources: [
      {
        label: 'ParlayPlay game rules',
        url: 'https://cdn.parlayplay.io/static/pdfs/game_rules.pdf',
        note: 'Draft fixture only; not registered by default.',
      },
    ],
    playTypes: [
      {
        id: 'more_less',
        displayName: 'More/Less',
        payoutModel: 'displayed-multiplier',
        pickCount: { min: 2, max: 12 },
        scaleDisplayedMultiplier: true,
      },
    ],
    tiePolicy: { type: 'push' },
    dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
    pushPolicy: { type: 'remove_leg', refundIfNoSurvivors: true },
    payoutSplit: { type: 'all_withdrawable' },
    validation: { duplicatePlayers: 'warn', sameTeam: 'allow', sameGame: 'allow' },
  }),
  defineBookPolicy({
    id: 'draftkings_pick6',
    displayName: 'DraftKings Pick6',
    version: 'draft-2026-05',
    effectiveFrom: '2026-05-01',
    status: 'draft',
    sources: [
      {
        label: 'DraftKings Pick6 rules and scoring',
        url: 'https://pick6.draftkings.com/pick6-rules-and-scoring',
        note: 'Draft fixture only; not registered by default.',
      },
    ],
    playTypes: [
      {
        id: 'pick6',
        displayName: 'Pick6',
        payoutModel: 'custom',
        pickCount: { min: 2, max: 6 },
      },
    ],
    tiePolicy: { type: 'more_wins_less_loses' },
    dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
    pushPolicy: { type: 'loss' },
    payoutSplit: { type: 'all_withdrawable' },
    validation: { duplicatePlayers: 'warn', sameTeam: 'allow', sameGame: 'allow' },
    payoutResolver: ({ stake, hits, pickCount }) => ({
      multiplier: hits === pickCount ? 10 : 0,
      payout: {
        total: hits === pickCount ? stake * 10 : 0,
        withdrawable: hits === pickCount ? stake * 10 : 0,
        bonus: 0,
      },
      explanationCode: 'settlement.draft_fixture_custom_payout',
      confidence: 'low',
    }),
  }),
];

export function defineBookPolicy(policy: DfsBookPolicy): DfsBookPolicy {
  if (!policy.id || !String(policy.id).trim()) {
    throw new Error('defineBookPolicy: id is required');
  }
  if (!policy.displayName || !policy.displayName.trim()) {
    throw new Error('defineBookPolicy: displayName is required');
  }
  if (!policy.version || !policy.version.trim()) {
    throw new Error('defineBookPolicy: version is required');
  }
  if (!policy.effectiveFrom || !policy.effectiveFrom.trim()) {
    throw new Error('defineBookPolicy: effectiveFrom is required');
  }
  if (!policy.playTypes.length) {
    throw new Error('defineBookPolicy: at least one play type is required');
  }
  if (policy.playTypes.some((playType) => !playType.id || !playType.displayName)) {
    throw new Error('defineBookPolicy: every play type needs an id and displayName');
  }
  return Object.freeze({
    ...policy,
    sources: Object.freeze([...policy.sources]),
    playTypes: Object.freeze(policy.playTypes.map((playType) => Object.freeze({ ...playType }))),
  });
}

export function definePayoutTable(table: DfsPayoutTableDefinition): DfsPayoutTableDefinition {
  if (!table.bookId || !String(table.bookId).trim()) {
    throw new Error('definePayoutTable: bookId is required');
  }
  if (!table.playTypeId || !String(table.playTypeId).trim()) {
    throw new Error('definePayoutTable: playTypeId is required');
  }
  if (!table.entries.length) {
    throw new Error('definePayoutTable: entries are required');
  }
  return Object.freeze({
    ...table,
    entries: Object.freeze(table.entries.map((entry) => Object.freeze({ ...entry }))),
  });
}

export function defineLeagueAdapter(
  adapter: DfsLeagueAdapterDefinition,
): DfsLeagueAdapterDefinition {
  if (!adapter.league || !adapter.league.trim()) {
    throw new Error('defineLeagueAdapter: league is required');
  }
  return Object.freeze({
    ...adapter,
    propAliases: adapter.propAliases ? Object.freeze({ ...adapter.propAliases }) : undefined,
    adapters: adapter.adapters ? Object.freeze({ ...adapter.adapters }) : undefined,
  });
}

export function defineStatProvider(provider: StatProvider): StatProvider {
  if (!provider.id || !provider.id.trim()) {
    throw new Error('defineStatProvider: id is required');
  }
  if (!provider.extractStat && !provider.getGameLog) {
    throw new Error('defineStatProvider: extractStat or getGameLog is required');
  }
  return provider;
}

export function adaptV2EntryInput(
  input: DfsV2EntryInput,
): DfsEntryInput & { app?: undefined; playType?: undefined } {
  const { app: legacyApp, playType: legacyPlayType, ...rest } = input;
  return {
    ...rest,
    bookId: legacyApp,
    playTypeId: legacyPlayType,
    app: undefined,
    playType: undefined,
  };
}

export function adaptBuzzrBetInput(input: CreateDfsBetInput): DfsEntryInput {
  return {
    entryId: input.parsedImageHash ?? `${input.userId}:${input.placedAt ?? 'draft'}`,
    bookId: input.app,
    playTypeId: input.playType,
    stake: input.stakeAmount,
    displayedMultiplier: input.multiplier,
    baseMultiplier: input.baseMultiplier,
    profitBoostPct: input.profitBoostPct,
    placedAt: input.placedAt,
    legs: input.legs.map((leg) => adaptBuzzrLeg(leg)),
    metadata: {
      userId: input.userId,
      source: input.source,
      visibility: input.visibility,
      initialStatus: input.initialStatus,
      settlementSource: input.settlementSource,
    },
  };
}

function adaptBuzzrLeg(leg: DfsBetLeg): DfsLegInput {
  return {
    legId: leg.legId,
    playerId: leg.playerAthleteId,
    playerName: leg.playerName,
    team: leg.playerTeam,
    league: leg.league,
    propType: normalizeDfsPropType(leg.propType),
    line: leg.line,
    direction: leg.direction,
    stat: leg.actualValue,
    status: leg.legStatus,
    gameId: leg.gameContext.gameId,
    gameDate: leg.gameContext.gameDate,
    metadata: {
      gameContext: leg.gameContext,
      linkage: leg.linkage,
      boostType: leg.boostType,
      gradingSnapshot: leg.gradingSnapshot,
    },
  };
}

export function createDfsEngine(config: DfsEngineConfig = {}): DfsEngine {
  const clock = config.clock ?? (() => new Date());
  const bookPolicies = new Map<DfsBookId, DfsBookPolicy>();
  const payoutTables: DfsPayoutTableDefinition[] = DEFAULT_PAYOUT_TABLES.map((table) => ({
    ...table,
    entries: [...table.entries],
  }));
  const leagueAdapters = new Map<string, DfsLeagueAdapterDefinition>();
  const statProviders = new Map<string, StatProvider>();

  for (const policy of DEFAULT_BOOK_POLICIES) {
    bookPolicies.set(policy.id, policy);
  }
  for (const policy of config.bookPolicies ?? []) {
    bookPolicies.set(policy.id, policy);
  }
  for (const table of config.payoutTables ?? []) {
    payoutTables.push(table);
  }
  for (const adapter of config.leagueAdapters ?? []) {
    leagueAdapters.set(normalizeLeague(adapter.league), adapter);
  }
  for (const provider of config.statProviders ?? []) {
    statProviders.set(provider.id, provider);
  }

  const auditMetadata = config.audit ?? {};

  function registerBookPolicy(policy: DfsBookPolicy): void {
    bookPolicies.set(policy.id, defineBookPolicy(policy));
  }

  function registerPayoutTable(table: DfsPayoutTableDefinition): void {
    payoutTables.push(definePayoutTable(table));
  }

  function registerLeagueAdapter(adapter: DfsLeagueAdapterDefinition): void {
    const defined = defineLeagueAdapter(adapter);
    leagueAdapters.set(normalizeLeague(defined.league), defined);
  }

  function registerStatProvider(provider: StatProvider): void {
    const defined = defineStatProvider(provider);
    statProviders.set(defined.id, defined);
  }

  function getRegisteredBooks(): DfsBookId[] {
    return [...bookPolicies.keys()];
  }

  function resolvePolicy(
    entry: Pick<DfsEntryInput, 'bookId' | 'playTypeId'>,
  ): { policy: DfsBookPolicy; playType: DfsBookPlayType } | null {
    const policy = bookPolicies.get(entry.bookId);
    if (!policy) {
      return null;
    }
    const playType = policy.playTypes.find((candidate) => candidate.id === entry.playTypeId);
    if (!playType) {
      return null;
    }
    return { policy, playType };
  }

  function findPayoutTable(
    bookId: DfsBookId,
    playTypeId: DfsPlayTypeId,
  ): DfsPayoutTableDefinition | null {
    return (
      [...payoutTables]
        .reverse()
        .find((table) => table.bookId === bookId && table.playTypeId === playTypeId) ?? null
    );
  }

  function lookupTableMultiplier(
    bookId: DfsBookId,
    playTypeId: DfsPlayTypeId,
    picks: number,
    hits: number,
  ): number | null {
    const table = findPayoutTable(bookId, playTypeId);
    if (!table) {
      return null;
    }
    return (
      table.entries.find((entry) => tableEntryPicks(entry) === picks && entry.hits === hits)
        ?.multiplier ?? null
    );
  }

  function resolveBaseMultiplier(input: DfsPayoutLookupInput): number | null {
    if (input.baseMultiplier != null) {
      return input.baseMultiplier;
    }
    return lookupTableMultiplier(input.bookId, input.playTypeId, input.pickCount, input.pickCount);
  }

  function normalizeEntry(input: DfsEntryInput): DfsEntryInput {
    const baseMultiplier =
      input.baseMultiplier ??
      lookupTableMultiplier(input.bookId, input.playTypeId, input.legs.length, input.legs.length);
    return {
      ...input,
      baseMultiplier,
      profitBoostPct: input.profitBoostPct ?? null,
      placedAt: input.placedAt ?? null,
      legs: input.legs.map((leg) => ({
        ...leg,
        league: normalizeLeague(leg.league),
        propType: normalizeDfsPropType(leg.propType),
      })),
    };
  }

  async function extractLegStat(
    leg: DfsLegInput,
    context: DfsSettlementContext = {},
    entry?: DfsEntryInput,
  ): Promise<DfsLegStatResult> {
    const contextStat = (context.statsByLegId ?? context.actualsByLegId)?.[leg.legId];
    if (typeof contextStat === 'number' && Number.isFinite(contextStat)) {
      return {
        ok: true,
        actual: contextStat,
        value: contextStat,
        source: 'context',
        providerId: context.providerId ?? context.statProviderId,
        provenance: provenance(
          'context',
          context.providerId ?? context.statProviderId,
          context.settledAt,
        ),
      };
    }

    if (typeof leg.stat === 'number' && Number.isFinite(leg.stat)) {
      return {
        ok: true,
        actual: leg.stat,
        value: leg.stat,
        source: 'input',
        provenance: provenance('input', undefined, context.settledAt),
      };
    }

    for (const provider of statProviders.values()) {
      if (context.statProviderId && provider.id !== context.statProviderId) {
        continue;
      }
      try {
        if (provider.extractStat) {
          const result = await provider.extractStat({ leg, context });
          if (result.ok) {
            return {
              ok: true,
              actual: result.actual,
              value: result.actual,
              source: 'stat_provider',
              providerId: provider.id,
              provenance: {
                source: result.source ?? provider.id,
                providerId: provider.id,
                sourceRef: result.sourceRef,
                observedAt: result.observedAt,
                confidence: result.confidence,
                raw: result.raw,
              },
            };
          }
        }
        if (provider.getGameLog && entry) {
          const rows = await provider.getGameLog({ leg, entry, context });
          for (const row of rows) {
            const localActual = runEngineLeagueAdapter(leg, row);
            if (localActual != null) {
              return {
                ok: true,
                actual: localActual,
                value: localActual,
                source: 'stat_provider',
                providerId: provider.id,
                provenance: {
                  source: 'league-adapter',
                  providerId: provider.id,
                  observedAt: context.settledAt,
                  confidence: 1,
                  raw: row,
                },
              };
            }
            const actual = runAdapter(leg, row, entry.bookId);
            if (actual != null) {
              return {
                ok: true,
                actual,
                value: actual,
                source: 'stat_provider',
                providerId: provider.id,
                provenance: {
                  source: 'stat-provider',
                  providerId: provider.id,
                  observedAt: context.settledAt,
                  confidence: 1,
                  raw: row,
                },
              };
            }
          }
        }
      } catch (error) {
        return {
          ok: false,
          reason: 'provider_error',
          source: 'stat_provider',
          providerId: provider.id,
          provenance: {
            source: provider.id,
            raw: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }

    function runEngineLeagueAdapter(
      legInput: DfsLegInput,
      rawEntry: PlayerGameLogEntryShape,
    ): number | null {
      const localAdapter = leagueAdapters.get(normalizeLeague(legInput.league));
      const localExtractor =
        localAdapter?.adapters?.[normalizeDfsPropType(legInput.propType)] ??
        localAdapter?.adapters?.[legInput.propType];
      if (!localExtractor) {
        return null;
      }

      const localActual = localExtractor(rawEntry, legInput);
      if (typeof localActual === 'number' && Number.isFinite(localActual)) {
        return localActual;
      }
      return null;
    }

    const providerData =
      context.providerDataByLegId?.[leg.legId] ?? context.actualEntry ?? leg.providerData;
    if (!providerData) {
      return {
        ok: false,
        reason: 'missing_provider_data',
        source: 'provider_data',
        provenance: provenance('provider_data', undefined, context.settledAt),
      };
    }

    const localActual = runEngineLeagueAdapter(leg, providerData);
    if (localActual != null) {
      return {
        ok: true,
        actual: localActual,
        value: localActual,
        source: 'provider_data',
        provenance: {
          ...provenance('league_adapter', undefined, context.settledAt),
          raw: providerData,
        },
      };
    }

    const actual = runAdapter(leg, providerData, entry?.bookId ?? 'prizepicks');
    if (actual == null) {
      return {
        ok: false,
        reason: 'unsupported_prop',
        source: 'provider_data',
        provenance: {
          ...provenance('provider_data', undefined, context.settledAt),
          raw: providerData,
        },
      };
    }

    return {
      ok: true,
      actual,
      value: actual,
      source: 'provider_data',
      provenance: {
        ...provenance('provider_data', undefined, context.settledAt),
        raw: providerData,
      },
    };
  }

  function gradeLeg(leg: DfsLegInput, actual: number, entry?: DfsEntryInput): DfsLegOutcome {
    const normalized = {
      ...leg,
      propType: normalizeDfsPropType(leg.propType),
      league: normalizeLeague(leg.league),
    };
    const resolution = entry ? resolvePolicy(entry) : null;
    const tiePolicy = resolution?.policy.tiePolicy ?? { type: 'push' };
    return gradeLegWithTiePolicy(normalized, actual, tiePolicy, entry, {});
  }

  function lookupPayout(input: DfsPayoutLookupInput): DfsPayoutResolution | null {
    const pseudoEntry =
      input.entry ??
      ({
        entryId: 'lookup',
        bookId: input.bookId,
        playTypeId: input.playTypeId,
        stake: input.stake,
        displayedMultiplier: input.displayedMultiplier ?? 0,
        baseMultiplier: input.baseMultiplier,
        profitBoostPct: input.profitBoostPct,
        legs: [],
      } satisfies DfsEntryInput);
    const resolved = resolvePolicy(pseudoEntry);
    if (!resolved) {
      return null;
    }
    return lookupPayoutForPolicy(
      {
        ...input,
        entry: pseudoEntry,
        decisions: input.decisions ?? [],
        losses: input.losses ?? 0,
        pushes: input.pushes ?? 0,
        removedCount: input.removedCount ?? 0,
      },
      resolved.policy,
      resolved.playType,
    );
  }

  function validateEntry(input: DfsEntryInput): DfsValidationResult {
    const errors: DfsValidationIssue[] = [];
    const warnings: DfsValidationIssue[] = [];
    const resolved = resolvePolicy(input);
    if (!resolved) {
      errors.push({
        code: 'validation.unknown_book_or_play_type',
        message: `No policy is registered for ${input.bookId}/${input.playTypeId}.`,
        severity: 'error',
      });
      return { ok: false, errors, warnings };
    }

    const { policy, playType } = resolved;
    const issueSink = (severity: DfsValidationSeverity): DfsValidationIssue[] | null => {
      if (severity === 'error') {
        return errors;
      }
      if (severity === 'warn') {
        return warnings;
      }
      return null;
    };

    if (input.legs.length < playType.pickCount.min || input.legs.length > playType.pickCount.max) {
      errors.push({
        code: 'validation.pick_count',
        message: `${policy.displayName} ${playType.displayName} requires ${playType.pickCount.min}-${playType.pickCount.max} picks.`,
        severity: 'error',
      });
    }

    const allowedLeagues = policy.validation?.leagues;
    if (allowedLeagues?.length) {
      const allowed = new Set(allowedLeagues.map((league) => normalizeLeague(league)));
      for (const leg of input.legs) {
        if (!allowed.has(normalizeLeague(leg.league))) {
          errors.push({
            code: 'validation.league_restricted',
            message: `${normalizeLeague(leg.league)} is not allowed by ${policy.displayName}.`,
            severity: 'error',
            legIds: [leg.legId],
          });
        }
      }
    }

    const duplicateSeverity = policy.validation?.duplicatePlayers ?? 'allow';
    const duplicateSink = issueSink(duplicateSeverity);
    if (duplicateSink) {
      const players = new Map<string, DfsLegInput[]>();
      for (const leg of input.legs) {
        const key = leg.playerId ?? leg.playerName.trim().toLowerCase();
        if (!key) {
          continue;
        }
        const existing = players.get(key) ?? [];
        existing.push(leg);
        players.set(key, existing);
      }
      for (const duplicate of players.values()) {
        if (duplicate.length > 1) {
          const key = duplicate[0].playerId ?? duplicate[0].playerName.trim().toLowerCase();
          duplicateSink.push({
            code: 'validation.duplicate_player',
            message: `Duplicate player ${key} is not allowed by ${policy.id}.`,
            severity: duplicateSeverity === 'error' ? 'error' : 'warning',
            legIds: duplicate.map((leg) => leg.legId),
          });
        }
      }
    }

    const sameTeamSeverity = policy.validation?.sameTeam ?? 'allow';
    const sameTeamSink = issueSink(sameTeamSeverity);
    if (sameTeamSink) {
      addGroupedValidationIssues({
        legs: input.legs,
        getKey: (leg) => leg.team?.trim().toUpperCase() || null,
        sink: sameTeamSink,
        severity: sameTeamSeverity === 'error' ? 'error' : 'warn',
        code: 'validation.same_team',
        message: (team) => `Multiple picks from ${team} are not allowed by ${policy.id}.`,
      });
    }

    const sameGameSeverity = policy.validation?.sameGame ?? 'allow';
    const sameGameSink = issueSink(sameGameSeverity);
    if (sameGameSink) {
      addGroupedValidationIssues({
        legs: input.legs,
        getKey: (leg) => leg.gameId?.trim() || null,
        sink: sameGameSink,
        severity: sameGameSeverity === 'error' ? 'error' : 'warn',
        code: 'validation.same_game',
        message: (gameId) => `Multiple picks from game ${gameId} are not allowed by ${policy.id}.`,
      });
    }

    return { ok: errors.length === 0, errors, warnings };
  }

  async function settleEntry(
    input: DfsEntryInput,
    context: DfsSettlementContext = {},
  ): Promise<DfsSettlementResult> {
    const entry = normalizeEntry(input);
    const settledAt = context.settledAt ?? clock().toISOString();
    const auditTrail: DfsSettlementResult['auditTrail'] = [
      {
        at: settledAt,
        code: 'settlement.started',
        message: `Started settlement for ${entry.entryId}.`,
        metadata: auditMetadata,
      },
    ];
    const validation = validateEntry(entry);
    const resolved = resolvePolicy(entry);
    if (!resolved) {
      return pendingResult({
        entry,
        settledAt,
        context,
        auditTrail,
        pendingReasons: ['missing_policy'],
        explanationCodes: ['validation.unknown_book_or_play_type'],
        validation,
      });
    }

    const { policy, playType } = resolved;
    const decisions: DfsLegDecision[] = [];
    const adjustments: DfsSettlementAdjustment[] = [];
    const pendingReasons: string[] = [];
    const explanationCodes = new Set<string>();
    for (const warning of validation.warnings) {
      explanationCodes.add(warning.code);
    }
    for (const error of validation.errors) {
      explanationCodes.add(error.code);
    }

    for (const leg of entry.legs) {
      const contextStatus =
        (context.legStatusesByLegId ?? context.legStatusByLegId)?.[leg.legId] ??
        leg.status ??
        leg.legStatus;
      if (contextStatus === 'dnp') {
        const outcome = resolveDnpOutcome(policy, leg, entry, context);
        decisions.push({
          legId: leg.legId,
          status: outcome,
          actual: null,
          line: leg.line,
          direction: leg.direction,
          playerName: leg.playerName,
          propType: leg.propType,
          provider: provenance('status', context.providerId, settledAt),
          pendingReason: null,
        });
        adjustments.push({
          type: outcome === 'manual' ? 'manual' : 'dnp',
          legId: leg.legId,
          message: `${leg.playerName} was marked ${outcome}.`,
        });
        explanationCodes.add(`leg.${outcome}`);
        continue;
      }
      if (
        contextStatus === 'void' ||
        contextStatus === 'rescued' ||
        contextStatus === 'canceled' ||
        contextStatus === 'manual'
      ) {
        decisions.push({
          legId: leg.legId,
          status: contextStatus,
          actual: null,
          line: leg.line,
          direction: leg.direction,
          playerName: leg.playerName,
          propType: leg.propType,
          provider: provenance('status', context.providerId, settledAt),
          pendingReason: null,
        });
        adjustments.push({
          type: contextStatus,
          legId: leg.legId,
          message: `${leg.playerName} was marked ${contextStatus}.`,
        });
        explanationCodes.add(`leg.${contextStatus}`);
        continue;
      }

      const stat = await extractLegStat(leg, context, entry);
      if (!stat.ok) {
        decisions.push({
          legId: leg.legId,
          status: 'pending',
          actual: null,
          line: leg.line,
          direction: leg.direction,
          playerName: leg.playerName,
          propType: leg.propType,
          provider: stat.provenance,
          pendingReason: stat.reason,
        });
        pendingReasons.push(`${leg.legId}:${stat.reason}`);
        explanationCodes.add(`leg.pending.${stat.reason}`);
        continue;
      }

      let status = gradeLegWithTiePolicy(leg, stat.actual, policy.tiePolicy, entry, context);
      if (status === 'push') {
        status = resolvePushOutcome(policy, leg, entry, context);
      }
      decisions.push({
        legId: leg.legId,
        status,
        actual: stat.actual,
        line: leg.line,
        direction: leg.direction,
        playerName: leg.playerName,
        propType: leg.propType,
        provider: stat.provenance,
        pendingReason: null,
      });
      if (status === 'push') {
        adjustments.push({
          type: 'push',
          legId: leg.legId,
          message: `${leg.playerName} pushed and was removed by policy.`,
        });
        explanationCodes.add('leg.push_removed');
      }
    }

    if (decisions.some((decision) => decision.status === 'manual')) {
      pendingReasons.push('manual_action_required');
      explanationCodes.add('settlement.manual_action_required');
    }

    if (pendingReasons.length) {
      auditTrail.push({
        at: settledAt,
        code: 'settlement.pending',
        message: 'Settlement is pending missing or unsupported stat data.',
      });
      return {
        entryId: entry.entryId,
        bookId: entry.bookId,
        playTypeId: entry.playTypeId,
        status: 'pending',
        multiplier: 0,
        effectiveMultiplier: 0,
        payout: EMPTY_PAYOUT,
        stake: entry.stake,
        displayedMultiplier: entry.displayedMultiplier,
        baseMultiplier: entry.baseMultiplier,
        profitBoostPct: entry.profitBoostPct,
        legs: decisions,
        adjustments,
        pendingReasons,
        policyVersion: policy.version,
        sourceRefs: [...policy.sources],
        confidence: 'low',
        explanationCodes: [...explanationCodes],
        provenance: {
          providers: decisions.map((decision) => decision.provider),
          settledAt,
          auditId: context.auditId ?? context.auditRunId,
        },
        auditTrail,
      };
    }

    const removedStatuses = new Set<DfsLegOutcome>(['dnp', 'push', 'void', 'rescued', 'canceled']);
    const active = decisions.filter((decision) => !removedStatuses.has(decision.status));
    const removed = decisions.length - active.length;
    if (active.length === 0) {
      adjustments.push({
        type: 'void',
        message: 'All legs were removed by policy, so the entry returns stake.',
      });
      explanationCodes.add('settlement.all_legs_removed_refund');
      return {
        entryId: entry.entryId,
        bookId: entry.bookId,
        playTypeId: entry.playTypeId,
        status: 'void',
        multiplier: 1,
        effectiveMultiplier: 1,
        payout: splitAllWithdrawable(entry.stake),
        stake: entry.stake,
        displayedMultiplier: entry.displayedMultiplier,
        baseMultiplier: entry.baseMultiplier,
        profitBoostPct: entry.profitBoostPct,
        legs: decisions,
        adjustments,
        pendingReasons,
        policyVersion: policy.version,
        sourceRefs: [...policy.sources],
        confidence: 'high',
        explanationCodes: [...explanationCodes],
        provenance: {
          providers: decisions.map((decision) => decision.provider),
          settledAt,
          auditId: context.auditId ?? context.auditRunId,
        },
        auditTrail: [
          ...auditTrail,
          {
            at: settledAt,
            code: 'settlement.void',
            message: 'Entry voided because no active legs remained.',
          },
        ],
      };
    }

    const hits = active.filter((decision) => decision.status === 'won').length;
    const losses = active.filter((decision) => decision.status === 'lost').length;
    const pushes = decisions.filter((decision) => decision.status === 'push').length;
    const payout = lookupPayoutForPolicy(
      {
        bookId: entry.bookId,
        playTypeId: entry.playTypeId,
        stake: entry.stake,
        displayedMultiplier: entry.displayedMultiplier,
        baseMultiplier: entry.baseMultiplier,
        profitBoostPct: entry.profitBoostPct,
        pickCount: active.length,
        hits,
        losses,
        pushes,
        removedCount: removed,
        entry,
        decisions,
      },
      policy,
      playType,
    ) ?? {
      status: losses > 0 ? 'lost' : 'pending',
      multiplier: 0,
      payout: EMPTY_PAYOUT,
      explanationCode: 'settlement.no_payout_resolution',
      confidence: 'low' as const,
    };

    explanationCodes.add(payout.explanationCode);
    if (removed > 0) {
      explanationCodes.add('settlement.repriced_after_removed_legs');
      adjustments.push({
        type: 'void',
        message: `Payout was recalculated after ${removed} leg${removed === 1 ? '' : 's'} were removed.`,
      });
    }

    auditTrail.push({
      at: settledAt,
      code: `settlement.${payout.status}`,
      message: `Entry settled as ${payout.status}.`,
      metadata: {
        multiplier: payout.multiplier,
        hits,
        losses,
        removed,
      },
    });

    const result: DfsSettlementResult = {
      entryId: entry.entryId,
      bookId: entry.bookId,
      playTypeId: entry.playTypeId,
      status: payout.status,
      multiplier: payout.multiplier,
      effectiveMultiplier: payout.multiplier,
      payout: payout.payout,
      stake: entry.stake,
      displayedMultiplier: entry.displayedMultiplier,
      baseMultiplier: entry.baseMultiplier,
      profitBoostPct: entry.profitBoostPct,
      legs: decisions,
      adjustments,
      pendingReasons,
      policyVersion: policy.version,
      sourceRefs: [...policy.sources],
      confidence: payout.confidence,
      explanationCodes: [...explanationCodes],
      provenance: {
        providers: decisions.map((decision) => decision.provider),
        settledAt,
        auditId: context.auditId ?? context.auditRunId,
      },
      auditTrail,
    };

    await config.settlementStore?.saveSettlement?.(result);
    return result;
  }

  function explainSettlement(result: DfsSettlementResult): string {
    const settled = result.legs.filter((leg) => leg.status !== 'pending').length;
    const total = result.legs.length;
    return `${result.entryId} settled as ${result.status} for ${result.bookId}/${result.playTypeId} at ${result.multiplier}x. ${settled}/${total} legs settled.`;
  }

  function lookupPayoutForPolicy(
    input: Required<Pick<DfsPayoutLookupInput, 'entry' | 'decisions'>> &
      Omit<DfsPayoutLookupInput, 'entry' | 'decisions'> & {
        losses: number;
        pushes: number;
        removedCount: number;
      },
    policy: DfsBookPolicy,
    playType: DfsBookPlayType,
  ): DfsPayoutResolution | null {
    if (playType.allOrNothing && input.losses > 0) {
      return {
        status: 'lost',
        multiplier: 0,
        payout: EMPTY_PAYOUT,
        explanationCode: 'settlement.all_or_nothing_loss',
        confidence: 'high',
      };
    }

    if (playType.payoutModel === 'custom') {
      if (!policy.payoutResolver) {
        return null;
      }
      const resolved = policy.payoutResolver({
        bookId: input.bookId,
        playTypeId: input.playTypeId,
        stake: input.stake,
        displayedMultiplier: input.displayedMultiplier,
        baseMultiplier: input.baseMultiplier,
        profitBoostPct: input.profitBoostPct,
        pickCount: input.pickCount,
        hits: input.hits,
        losses: input.losses,
        pushes: input.pushes,
        removedCount: input.removedCount,
        entry: input.entry,
        decisions: input.decisions,
      });
      const payout =
        resolved.payout ??
        splitPayout(policy, {
          stake: input.stake,
          multiplier: resolved.multiplier,
          totalPayout: input.stake * resolved.multiplier,
          baseMultiplier: input.baseMultiplier,
          profitBoostPct: input.profitBoostPct,
        });
      return {
        status: resolved.multiplier > 0 ? 'won' : 'lost',
        multiplier: resolved.multiplier,
        payout,
        explanationCode: resolved.explanationCode ?? 'settlement.custom_payout',
        confidence: resolved.confidence ?? 'medium',
      };
    }

    let multiplier: number | null = null;
    let explanationCode = 'settlement.fixed_table_payout';
    let baseForSplit = input.baseMultiplier ?? null;

    if (playType.payoutModel === 'displayed-multiplier') {
      multiplier = input.losses > 0 ? 0 : (input.displayedMultiplier ?? 0);
      explanationCode = 'settlement.displayed_multiplier_payout';
      baseForSplit = input.baseMultiplier ?? multiplier;
    } else {
      const tableMultiplier = lookupTableMultiplier(
        input.bookId,
        input.playTypeId,
        input.pickCount,
        input.hits,
      );
      if (tableMultiplier == null) {
        multiplier = 0;
        explanationCode = 'settlement.no_payout_table_row';
      } else if (playType.scaleDisplayedMultiplier && input.displayedMultiplier != null) {
        const baseAllHit =
          resolveBaseMultiplier(input) ??
          lookupTableMultiplier(input.bookId, input.playTypeId, input.pickCount, input.pickCount);
        const allHit = lookupTableMultiplier(
          input.bookId,
          input.playTypeId,
          input.pickCount,
          input.pickCount,
        );
        if (baseAllHit && allHit) {
          multiplier = (input.displayedMultiplier * tableMultiplier) / baseAllHit;
          baseForSplit = (baseAllHit * tableMultiplier) / allHit;
        } else {
          multiplier = tableMultiplier;
          baseForSplit = tableMultiplier;
        }
      } else {
        multiplier = tableMultiplier;
        baseForSplit = tableMultiplier;
      }
    }

    if (input.losses > 0 && multiplier <= 0) {
      return {
        status: 'lost',
        multiplier: 0,
        payout: EMPTY_PAYOUT,
        explanationCode,
        confidence: 'high',
      };
    }

    const payout = splitPayout(policy, {
      stake: input.stake,
      multiplier,
      totalPayout: input.stake * multiplier,
      baseMultiplier: baseForSplit,
      profitBoostPct: input.profitBoostPct,
    });
    return {
      status: multiplier > 0 ? 'won' : 'lost',
      multiplier,
      payout,
      explanationCode,
      confidence: explanationCode === 'settlement.no_payout_table_row' ? 'low' : 'high',
    };
  }

  return {
    normalizeEntry,
    extractLegStat,
    gradeLeg,
    lookupPayout,
    validateEntry,
    settleEntry,
    explainSettlement,
    registerBookPolicy,
    registerPayoutTable,
    registerLeagueAdapter,
    registerStatProvider,
    getRegisteredBooks,
  };
}

function splitPayout(
  policy: DfsBookPolicy,
  input: {
    stake: number;
    multiplier: number;
    totalPayout: number;
    baseMultiplier?: number | null;
    profitBoostPct?: number | null;
  },
): DfsPayoutSplit {
  if (input.multiplier <= 0 || input.totalPayout <= 0) {
    return EMPTY_PAYOUT;
  }
  if (policy.payoutSplit.type === 'custom') {
    return policy.payoutSplit.split(input);
  }
  if (policy.payoutSplit.type === 'underdog_bonus_split') {
    return computeBoostSplit({
      app: 'underdog',
      totalPayout: input.totalPayout,
      stake: input.stake,
      multiplier: input.multiplier,
      baseMultiplier: input.baseMultiplier ?? input.multiplier,
      profitBoostPct: input.profitBoostPct,
    });
  }
  return splitAllWithdrawable(input.totalPayout);
}

function splitAllWithdrawable(total: number): DfsPayoutSplit {
  return {
    total,
    withdrawable: total,
    bonus: 0,
  };
}

function gradeLegWithTiePolicy(
  leg: DfsLegInput,
  actual: number,
  tiePolicy: DfsTiePolicy,
  entry: DfsEntryInput | undefined,
  context: DfsSettlementContext,
): DfsLegOutcome {
  if (actual === leg.line) {
    if (tiePolicy.type === 'more_wins_less_loses') {
      return leg.direction === 'over' ? 'won' : 'lost';
    }
    if (tiePolicy.type === 'loss') {
      return 'lost';
    }
    if (tiePolicy.type === 'custom' && entry) {
      return tiePolicy.gradeTie({ leg, entry, context });
    }
    return 'push';
  }
  return gradeLegFromActual(leg.line, leg.direction, actual);
}

function resolveDnpOutcome(
  policy: DfsBookPolicy,
  leg: DfsLegInput,
  entry: DfsEntryInput,
  context: DfsSettlementContext,
): DfsLegOutcome {
  if (policy.dnpPolicy.type === 'custom') {
    return policy.dnpPolicy.resolve({ leg, entry, context });
  }
  if (policy.dnpPolicy.type === 'loss') {
    return 'lost';
  }
  if (policy.dnpPolicy.type === 'manual') {
    return 'manual';
  }
  return 'dnp';
}

function resolvePushOutcome(
  policy: DfsBookPolicy,
  leg: DfsLegInput,
  entry: DfsEntryInput,
  context: DfsSettlementContext,
): DfsLegOutcome {
  if (policy.pushPolicy.type === 'custom') {
    return policy.pushPolicy.resolve({ leg, entry, context });
  }
  if (policy.pushPolicy.type === 'loss') {
    return 'lost';
  }
  if (policy.pushPolicy.type === 'manual') {
    return 'manual';
  }
  return 'push';
}

function addGroupedValidationIssues(input: {
  legs: readonly DfsLegInput[];
  getKey: (leg: DfsLegInput) => string | null;
  sink: DfsValidationIssue[];
  severity: Exclude<DfsValidationSeverity, 'allow'>;
  code: string;
  message: (key: string) => string;
}): void {
  const groups = new Map<string, DfsLegInput[]>();
  for (const leg of input.legs) {
    const key = input.getKey(leg);
    if (!key) {
      continue;
    }
    const group = groups.get(key) ?? [];
    group.push(leg);
    groups.set(key, group);
  }

  for (const [key, group] of groups) {
    if (group.length < 2) {
      continue;
    }
    input.sink.push({
      code: input.code,
      message: input.message(key),
      severity: input.severity === 'error' ? 'error' : 'warning',
      legIds: group.map((leg) => leg.legId),
    });
  }
}

function runAdapter(
  leg: DfsLegInput,
  rawEntry: PlayerGameLogEntryShape,
  bookId: DfsBookId,
): number | null {
  const league = normalizeLeague(leg.league);
  const value = extractStatForProp(leg.propType, league, rawEntry, bookId as DfsApp);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function tableEntryPicks(entry: DfsPayoutTableEntry): number | null {
  return entry.picks ?? entry.pickCount ?? null;
}

function normalizeLeague(league: string): string {
  return league.trim().toUpperCase();
}

function provenance(
  source: string,
  sourceRef?: string,
  observedAt?: string,
): DfsProviderProvenance {
  return {
    source,
    sourceRef,
    observedAt,
    confidence: 1,
  };
}

function pendingResult(input: {
  entry: DfsEntryInput;
  settledAt: string;
  context: DfsSettlementContext;
  auditTrail: DfsSettlementResult['auditTrail'];
  pendingReasons: string[];
  explanationCodes: string[];
  validation: DfsValidationResult;
}): DfsSettlementResult {
  return {
    entryId: input.entry.entryId,
    bookId: input.entry.bookId,
    playTypeId: input.entry.playTypeId,
    status: 'pending',
    multiplier: 0,
    effectiveMultiplier: 0,
    payout: EMPTY_PAYOUT,
    stake: input.entry.stake,
    displayedMultiplier: input.entry.displayedMultiplier,
    baseMultiplier: input.entry.baseMultiplier,
    profitBoostPct: input.entry.profitBoostPct,
    legs: [],
    adjustments: [],
    pendingReasons: input.pendingReasons,
    policyVersion: null,
    sourceRefs: [],
    confidence: 'low',
    explanationCodes: [
      ...input.explanationCodes,
      ...input.validation.errors.map((issue) => issue.code),
      ...input.validation.warnings.map((issue) => issue.code),
    ],
    provenance: {
      providers: [],
      settledAt: input.settledAt,
      auditId: input.context.auditId ?? input.context.auditRunId,
    },
    auditTrail: [
      ...input.auditTrail,
      {
        at: input.settledAt,
        code: 'settlement.pending',
        message: 'Settlement could not run without a matching book policy.',
      },
    ],
  };
}
