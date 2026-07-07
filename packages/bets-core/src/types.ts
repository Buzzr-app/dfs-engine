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
