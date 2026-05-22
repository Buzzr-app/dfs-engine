export type DfsLegOutcome =
  | 'pending'
  | 'won'
  | 'lost'
  | 'push'
  | 'dnp'
  | 'void'
  | 'rescued'
  | 'canceled'
  | 'manual';

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
  actual?: number | null;
  status?: DfsLegOutcome | null;
  providerData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type DfsEntryInput = {
  entryId: string;
  bookId: string;
  playTypeId: string;
  stake: number;
  displayedMultiplier: number;
  baseMultiplier?: number | null;
  profitBoostPct?: number | null;
  legs: readonly DfsLegInput[];
  placedAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type BetStatus =
  | 'draft'
  | 'pending'
  | 'won'
  | 'lost'
  | 'pushed'
  | 'void'
  | 'cashed_out'
  | 'canceled';

export type BetKind = 'straight' | 'parlay' | 'dfs' | 'future' | 'prop' | string;
export type BetVisibility = 'private' | 'friends' | 'public';

export type LinkedAccountProvider =
  | 'kalshi'
  | 'underdog'
  | 'prizepicks'
  | 'sharpsports'
  | 'draftkings'
  | 'fanduel'
  | 'betmgm'
  | 'caesars'
  | 'espnbet'
  | 'hardrock'
  | 'fanatics'
  | string;

export type Sportsbook = {
  slug: string;
  displayName: string;
  provider?: LinkedAccountProvider;
  supportsAutoSync?: boolean;
  supportsScreenshotTemplate?: boolean;
  active?: boolean;
};

export type BetLeg = {
  legId: string;
  playerName?: string | null;
  playerId?: string | null;
  team?: string | null;
  opponent?: string | null;
  league?: string | null;
  market?: string | null;
  propType?: string | null;
  side?: string | null;
  line?: number | null;
  direction?: 'over' | 'under' | null;
  actual?: number | null;
  status?: DfsLegOutcome | 'pending' | null;
};

export type BetRecord = {
  id: string;
  userId: string;
  sportsbookSlug: string;
  externalSource?: LinkedAccountProvider | null;
  externalBetId?: string | null;
  kind: BetKind;
  status: BetStatus;
  stake: number;
  potentialPayout?: number | null;
  payout?: number | null;
  market?: string | null;
  league?: string | null;
  gameId?: string | null;
  side?: string | null;
  line?: number | null;
  americanOdds?: number | null;
  placedAt: string;
  settledAt?: string | null;
  visibility?: BetVisibility;
  fairLine?: number | null;
  edgePercent?: number | null;
  dfs?: {
    bookId?: string | null;
    playTypeId?: string | null;
    displayedMultiplier?: number | null;
    baseMultiplier?: number | null;
    profitBoostPct?: number | null;
  } | null;
  legs?: readonly BetLeg[];
};

export type OddsQuote = {
  side: string;
  americanOdds: number;
  sportsbookSlug?: string | null;
  line?: number | null;
  capturedAt?: string | null;
};

export type FairLineInput = {
  selected: OddsQuote;
  opposite: OddsQuote;
};

export type FairLineResult = {
  selectedSide: string;
  fairProbability: number;
  fairAmericanOdds: number;
  marketProbability: number;
  overround: number;
  edgePercent: number;
};

export type BetRollup = {
  totalBets: number;
  pending: number;
  won: number;
  lost: number;
  pushed: number;
  voided: number;
  canceled: number;
  staked: number;
  returned: number;
  netUnits: number;
  roiPercent: number;
  winRate: number;
  currentStreak: {
    status: 'won' | 'lost' | null;
    count: number;
  };
};

export type BetslipParseResult =
  | {
      ok: true;
      parser: 'apple_ocr' | 'template' | 'haiku' | 'sonnet' | string;
      confidence: number;
      bet: BetRecord;
      warnings?: readonly string[];
      rawText?: string;
    }
  | {
      ok: false;
      parser?: 'apple_ocr' | 'template' | 'haiku' | 'sonnet' | string;
      reason: 'empty_image' | 'unsupported_book' | 'low_confidence' | 'invalid_shape' | string;
      rawText?: string;
      warnings?: readonly string[];
    };

export type ExternalBetKeyInput = {
  userId: string;
  provider: LinkedAccountProvider;
  externalBetId: string;
};

export type DfsEntryAdapterOptions = {
  entryId?: string;
  bookId?: string;
  playTypeId?: string;
  displayedMultiplier?: number;
};

const SPORTSBOOK_ALIASES: Record<string, string> = {
  'bet mgm': 'betmgm',
  betmgm: 'betmgm',
  caesars: 'caesars',
  czr: 'caesars',
  'draft kings': 'draftkings',
  draftkings: 'draftkings',
  dk: 'draftkings',
  espnbet: 'espnbet',
  'espn bet': 'espnbet',
  fanatics: 'fanatics',
  fanduel: 'fanduel',
  fd: 'fanduel',
  hardrock: 'hardrock',
  'hard rock': 'hardrock',
  kalshi: 'kalshi',
  prizepicks: 'prizepicks',
  'prize picks': 'prizepicks',
  sharpsports: 'sharpsports',
  'sharp sports': 'sharpsports',
  underdog: 'underdog',
  'underdog fantasy': 'underdog',
};

export function normalizeSportsbookSlug(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalized) {
    throw new Error('normalizeSportsbookSlug: sportsbook value is required');
  }

  return SPORTSBOOK_ALIASES[normalized] ?? normalized.replace(/\s+/g, '-');
}

export function buildExternalBetKey(input: ExternalBetKeyInput): string {
  const userId = input.userId.trim();
  const externalBetId = input.externalBetId.trim();
  if (!userId) {
    throw new Error('buildExternalBetKey: userId is required');
  }
  if (!externalBetId) {
    throw new Error('buildExternalBetKey: externalBetId is required');
  }

  return [userId, normalizeSportsbookSlug(input.provider), externalBetId].join(':');
}

export function americanOddsToImpliedProbability(americanOdds: number): number {
  assertFiniteNumber(americanOdds, 'americanOdds');
  if (americanOdds === 0) {
    throw new Error('americanOddsToImpliedProbability: odds cannot be 0');
  }
  if (americanOdds > 0) {
    return round(100 / (americanOdds + 100), 6);
  }
  return round(Math.abs(americanOdds) / (Math.abs(americanOdds) + 100), 6);
}

export function probabilityToAmericanOdds(probability: number): number {
  assertProbability(probability, 'probability');
  if (probability >= 0.5) {
    return Math.round((-100 * probability) / (1 - probability));
  }
  return Math.round((100 * (1 - probability)) / probability);
}

export function calculateEdgePercent(input: {
  fairProbability: number;
  marketAmericanOdds: number;
}): number {
  assertProbability(input.fairProbability, 'fairProbability');
  return round(
    (input.fairProbability - americanOddsToImpliedProbability(input.marketAmericanOdds)) * 100,
    2,
  );
}

export function calculateNoVigFairLine(input: FairLineInput): FairLineResult {
  const selectedProbability = americanOddsToImpliedProbability(input.selected.americanOdds);
  const oppositeProbability = americanOddsToImpliedProbability(input.opposite.americanOdds);
  const totalProbability = selectedProbability + oppositeProbability;

  if (totalProbability <= 0) {
    throw new Error('calculateNoVigFairLine: odds pair has no probability');
  }

  const fairProbability = round(selectedProbability / totalProbability, 6);
  return {
    selectedSide: input.selected.side,
    fairProbability,
    fairAmericanOdds: probabilityToAmericanOdds(fairProbability),
    marketProbability: selectedProbability,
    overround: round(totalProbability - 1, 6),
    edgePercent: calculateEdgePercent({
      fairProbability,
      marketAmericanOdds: input.selected.americanOdds,
    }),
  };
}

export function calculateBetRollup(bets: readonly BetRecord[]): BetRollup {
  let pending = 0;
  let won = 0;
  let lost = 0;
  let pushed = 0;
  let voided = 0;
  let canceled = 0;
  let staked = 0;
  let returned = 0;

  for (const bet of bets) {
    if (bet.status === 'canceled') {
      canceled += 1;
      continue;
    }
    if (bet.status === 'draft') {
      pending += 1;
      continue;
    }

    staked += bet.stake;
    returned += returnedAmount(bet);

    if (bet.status === 'pending') {
      pending += 1;
    } else if (bet.status === 'won' || bet.status === 'cashed_out') {
      won += 1;
    } else if (bet.status === 'lost') {
      lost += 1;
    } else if (bet.status === 'pushed') {
      pushed += 1;
    } else if (bet.status === 'void') {
      voided += 1;
    }
  }

  const netUnits = round(returned - staked, 2);
  const decisions = won + lost;
  return {
    totalBets: bets.length,
    pending,
    won,
    lost,
    pushed,
    voided,
    canceled,
    staked: round(staked, 2),
    returned: round(returned, 2),
    netUnits,
    roiPercent: staked > 0 ? round((netUnits / staked) * 100, 2) : 0,
    winRate: decisions > 0 ? round((won / decisions) * 100, 2) : 0,
    currentStreak: calculateCurrentStreak(bets),
  };
}

export function betRecordToDfsEntryInput(
  bet: BetRecord,
  options: DfsEntryAdapterOptions = {},
): DfsEntryInput {
  const legs = bet.legs ?? [];
  if (!legs.length) {
    throw new Error('betRecordToDfsEntryInput: at least one leg is required');
  }

  const playTypeId = options.playTypeId ?? bet.dfs?.playTypeId;
  if (!playTypeId) {
    throw new Error('betRecordToDfsEntryInput: dfs.playTypeId is required');
  }

  const displayedMultiplier =
    options.displayedMultiplier ?? bet.dfs?.displayedMultiplier ?? inferDisplayedMultiplier(bet);
  assertPositiveNumber(bet.stake, 'stake');
  assertPositiveNumber(displayedMultiplier, 'displayedMultiplier');
  if (bet.dfs?.baseMultiplier != null) {
    assertPositiveNumber(bet.dfs.baseMultiplier, 'baseMultiplier');
  }
  if (bet.dfs?.profitBoostPct != null) {
    assertNonNegativeNumber(bet.dfs.profitBoostPct, 'profitBoostPct');
  }

  return {
    entryId: options.entryId ?? bet.id,
    bookId: options.bookId ?? bet.dfs?.bookId ?? normalizeSportsbookSlug(bet.sportsbookSlug),
    playTypeId,
    stake: bet.stake,
    displayedMultiplier,
    baseMultiplier: bet.dfs?.baseMultiplier ?? null,
    profitBoostPct: bet.dfs?.profitBoostPct ?? null,
    placedAt: bet.placedAt,
    legs: legs.map(toDfsLegInput),
  };
}

function toDfsLegInput(leg: BetLeg): DfsLegInput {
  if (!leg.playerName) {
    throw new Error(`betRecordToDfsEntryInput: ${leg.legId} playerName is required`);
  }
  if (!leg.league) {
    throw new Error(`betRecordToDfsEntryInput: ${leg.legId} league is required`);
  }
  if (!leg.propType) {
    throw new Error(`betRecordToDfsEntryInput: ${leg.legId} propType is required`);
  }
  if (leg.line == null) {
    throw new Error(`betRecordToDfsEntryInput: ${leg.legId} line is required`);
  }
  assertFiniteNumber(leg.line, `${leg.legId}.line`);
  if (leg.actual != null) {
    assertFiniteNumber(leg.actual, `${leg.legId}.actual`);
  }

  const direction = leg.direction ?? directionFromSide(leg.side);
  if (!direction) {
    throw new Error(`betRecordToDfsEntryInput: ${leg.legId} direction is required`);
  }

  return {
    legId: leg.legId,
    playerId: leg.playerId ?? null,
    playerName: leg.playerName,
    team: leg.team ?? null,
    opponent: leg.opponent ?? null,
    league: leg.league,
    propType: leg.propType,
    line: leg.line,
    direction,
    actual: leg.actual ?? null,
    status: leg.status ?? null,
  };
}

function directionFromSide(side: string | null | undefined): 'over' | 'under' | null {
  const normalized = side?.trim().toLowerCase();
  if (normalized === 'over' || normalized === 'more') {
    return 'over';
  }
  if (normalized === 'under' || normalized === 'less') {
    return 'under';
  }
  return null;
}

function inferDisplayedMultiplier(bet: BetRecord): number {
  if (bet.potentialPayout != null && bet.stake > 0) {
    return round(bet.potentialPayout / bet.stake, 4);
  }
  throw new Error('betRecordToDfsEntryInput: displayed multiplier is required');
}

function returnedAmount(bet: BetRecord): number {
  if (bet.payout != null) {
    return bet.payout;
  }
  if (bet.status === 'won' || bet.status === 'cashed_out') {
    return bet.potentialPayout ?? 0;
  }
  if (bet.status === 'pushed' || bet.status === 'void') {
    return bet.stake;
  }
  return 0;
}

function calculateCurrentStreak(bets: readonly BetRecord[]): BetRollup['currentStreak'] {
  const settled = bets
    .filter((bet) => bet.status === 'won' || bet.status === 'lost')
    .sort((a, b) => timestamp(b.settledAt ?? b.placedAt) - timestamp(a.settledAt ?? a.placedAt));

  const first = settled[0];
  if (!first) {
    return { status: null, count: 0 };
  }

  const firstStatus: 'won' | 'lost' = first.status === 'won' ? 'won' : 'lost';
  let count = 0;
  for (const bet of settled) {
    if (bet.status !== firstStatus) {
      break;
    }
    count += 1;
  }

  return { status: firstStatus, count };
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

function assertPositiveNumber(value: number, label: string): void {
  assertFiniteNumber(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
}

function assertNonNegativeNumber(value: number, label: string): void {
  assertFiniteNumber(value, label);
  if (value < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
}

function assertProbability(value: number, label: string): void {
  assertFiniteNumber(value, label);
  if (value <= 0 || value >= 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
