/* Shared Buzz model runtime for app and import scripts. */
import type {
  BuzzFactorContribution,
  BuzzGameRowInput,
  BuzzNarrativeFlags,
  BuzzScoreDiagnostics,
  BuzzScoreResolveOptions,
  EnrichGameRowOptions,
  EntertainmentGameInput,
  ResolvedBuzzScores,
} from './types';

const ENGINE_MODEL_LABEL = 'Buzz Engine';
const LITE_MODEL_LABEL = 'Buzz Lite';

type LeagueBuzzProfile = {
  primeTimeWeight: number;
  weekendWeight: number;
  rivalryWeight: number;
  marqueeWeight: number;
  marketWeight: number;
  scoringWeight: number;
  closenessWeight: number;
  varianceSpan: number;
  finalVarianceSpan: number;
};

type BuzzEstimate = {
  score: number;
  baseline: number;
  confidence: number;
  factors: BuzzFactorContribution[];
};

const LEAGUE_PREDICTED_BASE: Record<string, number> = {
  NBA: 6.4,
  WNBA: 6.2,
  NCAAM: 7.6,
  NFL: 6.5,
  MLB: 5.6,
  NHL: 5.9,
  MLS: 5.8,
  EPL: 6.0,
  WC: 6.6,
  LALIGA: 6.1,
  BUND: 5.9,
  SERIEA: 5.9,
  LIGUE1: 5.8,
  UCL: 6.8,
  LIGAMX: 5.9,
  NWSL: 6.1,
};
const LEAGUE_FINAL_BASE: Record<string, number> = {
  NBA: 5.8,
  WNBA: 5.6,
  NCAAM: 6.2,
  NFL: 5.9,
  MLB: 5.3,
  NHL: 5.4,
  MLS: 5.3,
  EPL: 5.4,
  WC: 5.8,
  LALIGA: 5.5,
  BUND: 5.4,
  SERIEA: 5.4,
  LIGUE1: 5.3,
  UCL: 5.9,
  LIGAMX: 5.4,
  NWSL: 5.6,
};
const LEAGUE_EXPECTED_TOTAL: Record<string, number> = {
  NBA: 224,
  WNBA: 160,
  NCAAM: 149,
  NFL: 46,
  MLB: 9,
  NHL: 6.2,
  MLS: 2.8,
  EPL: 2.8,
  WC: 2.7,
  LALIGA: 2.7,
  BUND: 3.1,
  SERIEA: 2.7,
  LIGUE1: 2.9,
  UCL: 2.9,
  LIGAMX: 2.8,
  NWSL: 3.0,
};
const LEAGUE_BUZZ_PROFILE: Record<string, LeagueBuzzProfile> = {
  NBA: {
    primeTimeWeight: 1.08,
    weekendWeight: 1.04,
    rivalryWeight: 1.04,
    marqueeWeight: 1.06,
    marketWeight: 1.03,
    scoringWeight: 1.08,
    closenessWeight: 1.02,
    varianceSpan: 0.44,
    finalVarianceSpan: 0.12,
  },
  WNBA: {
    primeTimeWeight: 1.1,
    weekendWeight: 1.06,
    rivalryWeight: 1.08,
    marqueeWeight: 1.08,
    marketWeight: 1.04,
    scoringWeight: 1.05,
    closenessWeight: 1.06,
    varianceSpan: 0.4,
    finalVarianceSpan: 0.11,
  },
  NCAAM: {
    primeTimeWeight: 1.12,
    weekendWeight: 1.14,
    rivalryWeight: 1.18,
    marqueeWeight: 1.14,
    marketWeight: 1.04,
    scoringWeight: 1.06,
    closenessWeight: 1.12,
    varianceSpan: 0.38,
    finalVarianceSpan: 0.1,
  },
  NFL: {
    primeTimeWeight: 1.15,
    weekendWeight: 1.14,
    rivalryWeight: 1.1,
    marqueeWeight: 1.12,
    marketWeight: 1.04,
    scoringWeight: 1.01,
    closenessWeight: 1.12,
    varianceSpan: 0.48,
    finalVarianceSpan: 0.15,
  },
  MLB: {
    primeTimeWeight: 0.95,
    weekendWeight: 1.04,
    rivalryWeight: 1.08,
    marqueeWeight: 1.02,
    marketWeight: 1.06,
    scoringWeight: 1.0,
    closenessWeight: 1.08,
    varianceSpan: 0.42,
    finalVarianceSpan: 0.16,
  },
  NHL: {
    primeTimeWeight: 0.98,
    weekendWeight: 1.03,
    rivalryWeight: 1.1,
    marqueeWeight: 1.02,
    marketWeight: 1.05,
    scoringWeight: 1.0,
    closenessWeight: 1.1,
    varianceSpan: 0.43,
    finalVarianceSpan: 0.16,
  },
  MLS: {
    primeTimeWeight: 0.96,
    weekendWeight: 1.08,
    rivalryWeight: 1.09,
    marqueeWeight: 1.01,
    marketWeight: 1.06,
    scoringWeight: 0.98,
    closenessWeight: 1.08,
    varianceSpan: 0.43,
    finalVarianceSpan: 0.15,
  },
  EPL: {
    primeTimeWeight: 0.98,
    weekendWeight: 1.12,
    rivalryWeight: 1.14,
    marqueeWeight: 1.04,
    marketWeight: 1.04,
    scoringWeight: 0.98,
    closenessWeight: 1.12,
    varianceSpan: 0.45,
    finalVarianceSpan: 0.16,
  },
  WC: {
    primeTimeWeight: 1.16,
    weekendWeight: 1.12,
    rivalryWeight: 1.12,
    marqueeWeight: 1.1,
    marketWeight: 1.0,
    scoringWeight: 0.98,
    closenessWeight: 1.12,
    varianceSpan: 0.5,
    finalVarianceSpan: 0.16,
  },
  LALIGA: {
    primeTimeWeight: 0.99,
    weekendWeight: 1.13,
    rivalryWeight: 1.15,
    marqueeWeight: 1.08,
    marketWeight: 1.04,
    scoringWeight: 0.98,
    closenessWeight: 1.12,
    varianceSpan: 0.46,
    finalVarianceSpan: 0.16,
  },
  BUND: {
    primeTimeWeight: 0.96,
    weekendWeight: 1.11,
    rivalryWeight: 1.11,
    marqueeWeight: 1.05,
    marketWeight: 1.03,
    scoringWeight: 1.01,
    closenessWeight: 1.1,
    varianceSpan: 0.44,
    finalVarianceSpan: 0.15,
  },
  SERIEA: {
    primeTimeWeight: 0.98,
    weekendWeight: 1.1,
    rivalryWeight: 1.13,
    marqueeWeight: 1.06,
    marketWeight: 1.03,
    scoringWeight: 0.97,
    closenessWeight: 1.12,
    varianceSpan: 0.45,
    finalVarianceSpan: 0.16,
  },
  LIGUE1: {
    primeTimeWeight: 0.97,
    weekendWeight: 1.09,
    rivalryWeight: 1.08,
    marqueeWeight: 1.05,
    marketWeight: 1.03,
    scoringWeight: 0.99,
    closenessWeight: 1.1,
    varianceSpan: 0.43,
    finalVarianceSpan: 0.15,
  },
  UCL: {
    primeTimeWeight: 1.08,
    weekendWeight: 1.08,
    rivalryWeight: 1.14,
    marqueeWeight: 1.14,
    marketWeight: 1.02,
    scoringWeight: 0.99,
    closenessWeight: 1.14,
    varianceSpan: 0.5,
    finalVarianceSpan: 0.17,
  },
  LIGAMX: {
    primeTimeWeight: 0.97,
    weekendWeight: 1.1,
    rivalryWeight: 1.11,
    marqueeWeight: 1.04,
    marketWeight: 1.05,
    scoringWeight: 0.99,
    closenessWeight: 1.1,
    varianceSpan: 0.44,
    finalVarianceSpan: 0.15,
  },
  NWSL: {
    primeTimeWeight: 1.0,
    weekendWeight: 1.11,
    rivalryWeight: 1.1,
    marqueeWeight: 1.08,
    marketWeight: 1.04,
    scoringWeight: 1.01,
    closenessWeight: 1.12,
    varianceSpan: 0.45,
    finalVarianceSpan: 0.15,
  },
};
const MARQUEE_TEAMS: Record<string, Set<string>> = {
  NBA: new Set([
    'los angeles lakers',
    'boston celtics',
    'golden state warriors',
    'new york knicks',
    'miami heat',
  ]),
  WNBA: new Set([
    'new york liberty',
    'las vegas aces',
    'indiana fever',
    'seattle storm',
    'connecticut sun',
  ]),
  NCAAM: new Set([
    'duke blue devils',
    'north carolina tar heels',
    'kansas jayhawks',
    'kentucky wildcats',
    'uconn huskies',
    'gonzaga bulldogs',
    'auburn tigers',
    'alabama crimson tide',
    'houston cougars',
    'purdue boilermakers',
    'michigan state spartans',
    'tennessee volunteers',
    'arizona wildcats',
    'marquette golden eagles',
    'creighton bluejays',
    'florida gators',
    'texas longhorns',
    'iowa state cyclones',
    'baylor bears',
    'illinois fighting illini',
    'ucla bruins',
    'nc state wolfpack',
    'indiana hoosiers',
    'oregon ducks',
    'san diego state aztecs',
    'memphis tigers',
    'villanova wildcats',
    "st. john's red storm",
    'dayton flyers',
  ]),
  NFL: new Set([
    'dallas cowboys',
    'kansas city chiefs',
    'green bay packers',
    'san francisco 49ers',
    'buffalo bills',
  ]),
  MLB: new Set([
    'new york yankees',
    'los angeles dodgers',
    'boston red sox',
    'chicago cubs',
    'atlanta braves',
  ]),
  NHL: new Set([
    'toronto maple leafs',
    'new york rangers',
    'boston bruins',
    'montreal canadiens',
    'chicago blackhawks',
  ]),
  MLS: new Set(['inter miami cf', 'la galaxy', 'lafc', 'atlanta united fc', 'seattle sounders fc']),
  EPL: new Set(['arsenal', 'liverpool', 'manchester city', 'manchester united', 'chelsea']),
  WC: new Set(['argentina', 'brazil', 'england', 'france', 'spain']),
  LALIGA: new Set(['real madrid', 'barcelona', 'atletico madrid', 'sevilla', 'athletic club']),
  BUND: new Set(['bayern munich', 'borussia dortmund', 'rb leipzig', 'bayer leverkusen']),
  SERIEA: new Set(['inter milan', 'ac milan', 'juventus', 'napoli', 'roma']),
  LIGUE1: new Set(['paris saint-germain', 'marseille', 'lyon', 'monaco']),
  UCL: new Set([
    'real madrid',
    'barcelona',
    'bayern munich',
    'manchester city',
    'liverpool',
    'paris saint-germain',
  ]),
  LIGAMX: new Set([
    'club america',
    'chivas guadalajara',
    'tigres uanl',
    'cf monterrey',
    'cruz azul',
  ]),
  NWSL: new Set([
    'orlando pride',
    'gotham fc',
    'portland thorns fc',
    'angel city fc',
    'washington spirit',
  ]),
};
const DEFAULT_LEAGUE = 'NBA';
const LEAGUE_ALIASES: Record<string, string> = {
  UFC: 'NFL',
  BOXING: 'NFL',
};
const RIVALRY_PAIR_KEYS = new Set([
  'arsenal|tottenham hotspur',
  'boston celtics|los angeles lakers',
  'chelsea|tottenham hotspur',
  'chicago bears|green bay packers',
  'chicago cubs|st. louis cardinals',
  'dallas cowboys|philadelphia eagles',
  'france|germany',
  'green bay packers|minnesota vikings',
  'la galaxy|lafc',
  'los angeles dodgers|san francisco giants',
  'manchester city|manchester united',
  'montreal canadiens|toronto maple leafs',
  'new york mets|new york yankees',
  'new york rangers|new york islanders',
  'real madrid|barcelona',
  // NFL - modern top rivalries (v5 expansion from the NFL buzz audit)
  'buffalo bills|cincinnati bengals',
  'buffalo bills|kansas city chiefs',
  'buffalo bills|miami dolphins',
  'baltimore ravens|pittsburgh steelers',
  'baltimore ravens|cincinnati bengals',
  'cincinnati bengals|cleveland browns',
  'kansas city chiefs|las vegas raiders',
  'dallas cowboys|san francisco 49ers',
  'detroit lions|green bay packers',
  'philadelphia eagles|washington commanders',
  // NCAAM - iconic rivalries
  'duke blue devils|north carolina tar heels',
  'indiana hoosiers|purdue boilermakers',
  'kansas jayhawks|missouri tigers',
  'kentucky wildcats|louisville cardinals',
  'michigan state spartans|michigan wolverines',
  'ohio state buckeyes|michigan wolverines',
  'north carolina tar heels|nc state wolfpack',
  // NCAAM - strong rivalries
  'auburn tigers|alabama crimson tide',
  'florida gators|tennessee volunteers',
  'alabama crimson tide|tennessee volunteers',
  'florida gators|kentucky wildcats',
  "gonzaga bulldogs|saint mary's gaels",
  'kansas jayhawks|kansas state wildcats',
  'texas longhorns|texas a&m aggies',
  'uconn huskies|villanova wildcats',
  'ucla bruins|usc trojans',
  'marquette golden eagles|creighton bluejays',
  'louisville cardinals|cincinnati bearcats',
  'georgetown hoyas|syracuse orange',
  'iowa hawkeyes|iowa state cyclones',
  'arizona wildcats|arizona state sun devils',
  // WNBA - marquee rivalries
  'las vegas aces|new york liberty',
  'connecticut sun|las vegas aces',
  'indiana fever|new york liberty',
  'chicago sky|indiana fever',
  'las vegas aces|seattle storm',
  'minnesota lynx|seattle storm',
]);

function clampScore(score: number): number {
  return Math.max(1, Math.min(10, Number(score.toFixed(2))));
}
function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
function clampDelta(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
function normalizeScore(score: number | null | undefined): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return null;
  }
  if (score < 1 || score > 10) {
    return null;
  }
  return score;
}
function resolveLeague(league: string | null | undefined): string {
  const candidate = league ?? DEFAULT_LEAGUE;
  if (
    LEAGUE_BUZZ_PROFILE[candidate] &&
    LEAGUE_PREDICTED_BASE[candidate] != null &&
    LEAGUE_FINAL_BASE[candidate] != null &&
    LEAGUE_EXPECTED_TOTAL[candidate] != null
  ) {
    return candidate;
  }
  const alias = LEAGUE_ALIASES[candidate];
  if (
    alias &&
    LEAGUE_BUZZ_PROFILE[alias] &&
    LEAGUE_PREDICTED_BASE[alias] != null &&
    LEAGUE_FINAL_BASE[alias] != null &&
    LEAGUE_EXPECTED_TOTAL[alias] != null
  ) {
    return alias;
  }
  return DEFAULT_LEAGUE;
}
function getLeagueProfile(league: string): LeagueBuzzProfile {
  return LEAGUE_BUZZ_PROFILE[league] ?? (LEAGUE_BUZZ_PROFILE[DEFAULT_LEAGUE] as LeagueBuzzProfile);
}
function getLeagueNumber(table: Record<string, number>, league: string, fallback: number): number {
  return table[league] ?? table[DEFAULT_LEAGUE] ?? fallback;
}

/**
 * Single team-name normalization used by every rivalry / marquee /
 * shared-city lookup: lowercase, diacritic-insensitive, trimmed, and with
 * internal whitespace collapsed.
 */
export function normalizeTeamName(team: unknown): string {
  return String(team ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Resolve an optional injectable clock to epoch milliseconds. */
export function resolveNowMs(now?: number | Date): number {
  if (now instanceof Date) {
    const time = now.getTime();
    return Number.isNaN(time) ? Date.now() : time;
  }
  if (typeof now === 'number' && Number.isFinite(now)) {
    return now;
  }
  return Date.now();
}

function nthSundayOfMonth(year: number, monthIndex: number, nth: number): number {
  const firstDayOfWeek = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const firstSunday = 1 + ((7 - firstDayOfWeek) % 7);
  return firstSunday + (nth - 1) * 7;
}

/**
 * US Eastern UTC offset in minutes for a given instant, computed from the
 * statutory DST rule (second Sunday in March 2:00 → first Sunday in November
 * 2:00). Returns -240 (EDT) inside the DST window and -300 (EST) outside.
 */
export function easternUtcOffsetMinutes(utcMs: number): number {
  const year = new Date(utcMs).getUTCFullYear();
  // DST begins at 2:00 AM EST (UTC-5) on the second Sunday in March → 07:00 UTC.
  const dstStartMs = Date.UTC(year, 2, nthSundayOfMonth(year, 2, 2), 7, 0, 0);
  // DST ends at 2:00 AM EDT (UTC-4) on the first Sunday in November → 06:00 UTC.
  const dstEndMs = Date.UTC(year, 10, nthSundayOfMonth(year, 10, 1), 6, 0, 0);
  return utcMs >= dstStartMs && utcMs < dstEndMs ? -240 : -300;
}

type GameTimeInput = Pick<
  EntertainmentGameInput,
  'startsAt' | 'venueUtcOffsetMinutes' | 'localStartHour'
>;

function parseStartMs(startsAt: string | null | undefined): number | null {
  const timestamp = Date.parse(String(startsAt ?? ''));
  return Number.isNaN(timestamp) ? null : timestamp;
}

function localStartDate(game: GameTimeInput): Date | null {
  const startMs = parseStartMs(game.startsAt);
  if (startMs == null) {
    return null;
  }
  const explicit = game.venueUtcOffsetMinutes;
  const offsetMinutes =
    typeof explicit === 'number' && Number.isFinite(explicit)
      ? clampDelta(explicit, -840, 840)
      : easternUtcOffsetMinutes(startMs);
  return new Date(startMs + offsetMinutes * 60_000);
}

function resolveLocalStartHour(game: GameTimeInput): number | null {
  const explicit = game.localStartHour;
  if (
    typeof explicit === 'number' &&
    Number.isFinite(explicit) &&
    explicit >= 0 &&
    explicit <= 23
  ) {
    return Math.floor(explicit);
  }
  return localStartDate(game)?.getUTCHours() ?? null;
}

function resolveLocalStartDay(game: GameTimeInput): number | null {
  return localStartDate(game)?.getUTCDay() ?? null;
}

function hoursUntilStart(startsAt: string | null | undefined, nowMs: number): number | null {
  const startMs = parseStartMs(startsAt);
  if (startMs == null) {
    return null;
  }
  return (startMs - nowMs) / (1000 * 60 * 60);
}

function startMonthUtc(startsAt: string | null | undefined): number {
  const startMs = parseStartMs(startsAt);
  return startMs == null ? -1 : new Date(startMs).getUTCMonth();
}

function toPairKey(left: string, right: string): string {
  return [left, right].sort().join('|');
}
function getRivalryBoost(
  homeTeam: string | undefined,
  awayTeam: string | undefined,
  league: string,
): number {
  const home = normalizeTeamName(homeTeam);
  const away = normalizeTeamName(awayTeam);
  if (!home || !away) {
    return 0;
  }
  if (!RIVALRY_PAIR_KEYS.has(toPairKey(home, away))) {
    return 0;
  }
  // NCAAM rivalries get a bigger boost - tournament intensity
  return league === 'NCAAM' ? 0.82 : 0.52;
}
function getMarqueeBoost(
  league: string,
  homeTeam: string | undefined,
  awayTeam: string | undefined,
): number {
  const marqueeTeams = MARQUEE_TEAMS[league] ?? MARQUEE_TEAMS[resolveLeague(league)];
  const home = normalizeTeamName(homeTeam);
  const away = normalizeTeamName(awayTeam);
  if (!marqueeTeams) {
    return 0;
  }
  let count = 0;
  if (home && marqueeTeams.has(home)) {
    count += 1;
  }
  if (away && marqueeTeams.has(away)) {
    count += 1;
  }
  if (count >= 2) {
    return 0.36;
  }
  if (count === 1) {
    return 0.18;
  }
  return 0;
}
function getSharedCityBoost(homeTeam: string | undefined, awayTeam: string | undefined): number {
  const homeParts = normalizeTeamName(homeTeam).split(' ').filter(Boolean);
  const awayParts = normalizeTeamName(awayTeam).split(' ').filter(Boolean);
  if (homeParts.length < 2 || awayParts.length < 2) {
    return 0;
  }
  const homeCity = homeParts.slice(0, 2).join(' ');
  const awayCity = awayParts.slice(0, 2).join(' ');
  if (homeCity && homeCity === awayCity) {
    return 0.24;
  }
  if (homeParts[0] && homeParts[0] === awayParts[0]) {
    return 0.16;
  }
  return 0;
}
function stableUnitHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}
function signatureVariance(game: EntertainmentGameInput, span: number): number {
  const key = [
    resolveLeague(game.league),
    String(game.startsAt ?? '').slice(0, 10),
    normalizeTeamName(game.homeTeam),
    normalizeTeamName(game.awayTeam),
  ].join('|');
  const centered = (stableUnitHash(key) - 0.5) * 2;
  return centered * span;
}
function pushFactor(
  factors: BuzzFactorContribution[],
  id: string,
  label: string,
  impact: number,
): void {
  if (Math.abs(impact) < 0.01) {
    return;
  }
  factors.push({
    id,
    label,
    impact: Number(impact.toFixed(2)),
  });
}
/**
 * Applies narrative-based scoring factors when the caller has detected
 * narrative tags via the narratives pipeline (BUZ-38).
 *
 * Narrative flags are additive - they layer on top of the model's existing
 * static rivalry/marquee detection. To avoid double-counting, the rivalry
 * narrative only fires when the static RIVALRY_PAIR_KEYS lookup missed it
 * (i.e. the pair isn't in our hardcoded set but the narratives service
 * detected it from a broader data source).
 */
function applyNarrativeFactors(
  narratives: BuzzNarrativeFlags | undefined,
  factors: BuzzFactorContribution[],
  league: string,
  existingRivalryBoost: number,
): number {
  if (!narratives) return 0;
  let delta = 0;
  // Rivalry from narratives pipeline - only add if static detection didn't already fire
  if (narratives.isRivalry && existingRivalryBoost === 0) {
    const intensity = narratives.rivalryIntensity ?? 1;
    // Scale: intensity 1 → 0.22, 2 → 0.38, 3 → 0.54
    const rivalryDelta = 0.22 + (intensity - 1) * 0.16;
    const profile = LEAGUE_BUZZ_PROFILE[league];
    const weighted = rivalryDelta * (profile ? profile.rivalryWeight : 1);
    pushFactor(factors, 'narrative_rivalry', 'Rivalry storyline', weighted);
    delta += weighted;
  }
  // Player vs former team - always entertaining ("revenge game")
  if (narratives.playerVsFormerTeam) {
    pushFactor(factors, 'vs_former_team', 'Revenge game storyline', 0.28);
    delta += 0.28;
  }
  // Player debut - mild interest boost
  if (narratives.hasDebut) {
    pushFactor(factors, 'debut', 'Player debut storyline', 0.15);
    delta += 0.15;
  }
  return delta;
}
function selectTopFactors(factors: BuzzFactorContribution[], limit = 6): BuzzFactorContribution[] {
  return [...factors]
    .sort((left, right) => Math.abs(right.impact) - Math.abs(left.impact))
    .slice(0, limit);
}
function estimatePredictedBuzzScore(game: EntertainmentGameInput, nowMs: number): BuzzEstimate {
  const league = resolveLeague(game.league);
  const profile = getLeagueProfile(league);
  const baseline = getLeagueNumber(LEAGUE_PREDICTED_BASE, league, 6.0);
  let score = baseline;
  const factors: BuzzFactorContribution[] = [];
  const localHour = resolveLocalStartHour(game);
  if (typeof localHour === 'number') {
    const rawPrimeTimeBoost =
      localHour >= 19 && localHour <= 22
        ? 0.38
        : localHour >= 16 && localHour <= 18
          ? 0.2
          : localHour < 11
            ? -0.22
            : 0;
    const primeTimeBoost = rawPrimeTimeBoost * profile.primeTimeWeight;
    pushFactor(factors, 'time_window', 'Tipoff window', primeTimeBoost);
    score += primeTimeBoost;
  }
  const localDay = resolveLocalStartDay(game);
  if (localDay === 0 || localDay === 6) {
    const weekendBoost = 0.16 * profile.weekendWeight;
    pushFactor(factors, 'weekend', 'Weekend audience', weekendBoost);
    score += weekendBoost;
  }
  const hoursToStart = hoursUntilStart(game.startsAt ?? '', nowMs);
  if (game.status === 'scheduled' && typeof hoursToStart === 'number') {
    const leadupDelta =
      hoursToStart <= 2
        ? 0.34
        : hoursToStart <= 8
          ? 0.24
          : hoursToStart <= 24
            ? 0.12
            : hoursToStart >= 168
              ? -0.28
              : hoursToStart >= 96
                ? -0.18
                : 0;
    if (leadupDelta !== 0) {
      pushFactor(factors, 'leadup', 'Countdown urgency', leadupDelta);
      score += leadupDelta;
    }
  }
  if (game.status === 'in_progress') {
    pushFactor(factors, 'status', 'Game already live', 0.62);
    score += 0.62;
  } else if (game.status === 'cancelled') {
    pushFactor(factors, 'status', 'Cancelled game', -1.2);
    score -= 1.2;
  } else if (game.status === 'postponed') {
    pushFactor(factors, 'status', 'Postponed game', -0.95);
    score -= 0.95;
  }
  const rivalryBoost = getRivalryBoost(game.homeTeam, game.awayTeam, league);
  if (rivalryBoost > 0) {
    const weightedRivalryBoost = rivalryBoost * profile.rivalryWeight;
    pushFactor(factors, 'rivalry', 'Rivalry intensity', weightedRivalryBoost);
    score += weightedRivalryBoost;
  }
  const marqueeBoost = getMarqueeBoost(league, game.homeTeam, game.awayTeam);
  if (marqueeBoost > 0) {
    const weightedMarqueeBoost = marqueeBoost * profile.marqueeWeight;
    pushFactor(factors, 'marquee', 'Marquee teams', weightedMarqueeBoost);
    score += weightedMarqueeBoost;
  }
  const sameCityBoost = getSharedCityBoost(game.homeTeam, game.awayTeam);
  if (sameCityBoost > 0) {
    const weightedSameCityBoost = sameCityBoost * profile.marketWeight;
    pushFactor(factors, 'market_overlap', 'Shared market buzz', weightedSameCityBoost);
    score += weightedSameCityBoost;
  }
  // NCAAM tournament: single-elimination drama - win-or-go-home in March/April,
  // reduced boost during regular season.
  if (league === 'NCAAM') {
    const gameMonth = startMonthUtc(game.startsAt);
    const isTournamentWindow = gameMonth === 2 || gameMonth === 3; // March or April
    const tournamentDelta = isTournamentWindow ? 0.9 : 0.32;
    const tournamentLabel = isTournamentWindow ? 'March Madness intensity' : 'College hoops energy';
    pushFactor(factors, 'tournament_drama', tournamentLabel, tournamentDelta);
    score += tournamentDelta;
  }
  const contextVariance = signatureVariance(game, profile.varianceSpan);
  pushFactor(factors, 'context', 'Matchup context', contextVariance);
  score += contextVariance;
  // Narrative features from detection pipeline (BUZ-39)
  const narrativeDelta = applyNarrativeFactors(game.narratives, factors, league, rivalryBoost);
  score += narrativeDelta;
  if (game.homeTeam && game.awayTeam && game.homeTeam === game.awayTeam) {
    pushFactor(factors, 'invalid_matchup', 'Invalid matchup', -0.45);
    score -= 0.45;
  }
  let confidence = 0.52;
  if (typeof localHour === 'number') {
    confidence += 0.08;
  }
  if (typeof hoursToStart === 'number' && hoursToStart >= 0 && hoursToStart <= 24) {
    confidence += 0.05;
  }
  if (rivalryBoost > 0) {
    confidence += 0.08;
  }
  if (marqueeBoost > 0) {
    confidence += 0.06;
  }
  if (game.status === 'in_progress') {
    confidence += 0.07;
  }
  if (narrativeDelta > 0) {
    confidence += 0.05;
  }
  return {
    score: clampScore(score),
    baseline,
    confidence: clampUnit(confidence),
    factors: selectTopFactors(factors),
  };
}
function estimateCompletedBuzzScore(game: EntertainmentGameInput): BuzzEstimate | null {
  const league = resolveLeague(game.league);
  const profile = getLeagueProfile(league);
  const baseline = getLeagueNumber(LEAGUE_FINAL_BASE, league, 5.4);
  const factors: BuzzFactorContribution[] = [];
  if (game.status === 'cancelled') {
    const cancellationAdjustment = 1.4 - baseline;
    pushFactor(factors, 'status', 'Cancelled game', cancellationAdjustment);
    return {
      score: 1.4,
      baseline,
      confidence: 0.92,
      factors: selectTopFactors(factors),
    };
  }
  const homeScore = typeof game.homeScore === 'number' ? game.homeScore : null;
  const awayScore = typeof game.awayScore === 'number' ? game.awayScore : null;
  if (homeScore == null || awayScore == null) {
    return null;
  }
  const expectedTotal = getLeagueNumber(LEAGUE_EXPECTED_TOTAL, league, 100);
  const total = homeScore + awayScore;
  const margin = Math.abs(homeScore - awayScore);
  let score = baseline;
  let scoringVolumeDelta = clampDelta(
    ((total - expectedTotal) / Math.max(expectedTotal, 1)) * 2.1 * profile.scoringWeight,
    -1.2,
    1.45,
  );
  // Interaction term: dampen scoring volume penalty when the game is close.
  // A low-scoring nail-biter is still entertaining - closeness dominates pace.
  if (scoringVolumeDelta < 0 && margin <= 5) {
    scoringVolumeDelta *= 0.35;
  }
  pushFactor(factors, 'scoring_volume', 'Scoring volume', scoringVolumeDelta);
  score += scoringVolumeDelta;
  let closenessDelta = 0;
  if (margin <= 1) {
    closenessDelta = 1.7;
  } else if (margin <= 3) {
    closenessDelta = 1.35;
  } else if (margin <= 7) {
    closenessDelta = 0.72;
  } else if (margin <= 14) {
    closenessDelta = 0.24;
  } else if (margin <= 20) {
    closenessDelta = -0.18;
  } else {
    closenessDelta = -0.48;
  }
  closenessDelta *= profile.closenessWeight;
  pushFactor(factors, 'closeness', 'Score margin', closenessDelta);
  score += closenessDelta;
  if (game.status === 'in_progress') {
    pushFactor(factors, 'status', 'Live volatility', 0.34);
    score += 0.34;
  }
  const finishPressureDelta = margin <= 2 ? 0.24 : margin >= 18 ? -0.24 : 0;
  if (finishPressureDelta !== 0) {
    pushFactor(factors, 'finish_pressure', 'Late-game pressure', finishPressureDelta);
    score += finishPressureDelta;
  }
  if ((league === 'NBA' || league === 'NCAAM') && total >= expectedTotal * 1.18 && margin <= 6) {
    pushFactor(factors, 'pace_spike', 'Pace spike proxy', 0.26);
    score += 0.26;
  }
  const efficiency = total / Math.max(expectedTotal, 1);
  if (efficiency > 1.22 && margin <= 10) {
    const shootoutDelta = 0.22 * profile.scoringWeight;
    pushFactor(factors, 'shootout', 'High-event shootout', shootoutDelta);
    score += shootoutDelta;
  } else if (efficiency < 0.72 && margin <= 3) {
    const defensiveBattleDelta = 0.18 * profile.closenessWeight;
    pushFactor(factors, 'defense', 'Defensive battle', defensiveBattleDelta);
    score += defensiveBattleDelta;
  } else if (efficiency < 0.62 && margin > 12) {
    pushFactor(factors, 'stale_flow', 'Low-event blowout', -0.24);
    score -= 0.24;
  }
  if (margin <= 1 && total >= expectedTotal * 0.92) {
    pushFactor(factors, 'clutch_finish', 'Clutch finish pressure', 0.34);
    score += 0.34;
  }
  // Tournament / postseason bonus - win-or-go-home games are structurally
  // more entertaining regardless of the teams involved.
  if (league === 'NCAAM' && game.startsAt) {
    const month = startMonthUtc(game.startsAt); // 0-indexed
    if (month === 2 || month === 3) {
      // March or April
      pushFactor(factors, 'tournament', 'March Madness stakes', 0.35);
      score += 0.35;
    }
  }
  const rivalryBoost = getRivalryBoost(game.homeTeam, game.awayTeam, league);
  if (rivalryBoost > 0) {
    const weightedRivalryBoost = rivalryBoost * 0.5 * profile.rivalryWeight;
    pushFactor(factors, 'rivalry', 'Rivalry intensity', weightedRivalryBoost);
    score += weightedRivalryBoost;
  }
  const marqueeBoost = getMarqueeBoost(league, game.homeTeam, game.awayTeam);
  if (marqueeBoost > 0) {
    const weightedMarqueeBoost = marqueeBoost * 0.62 * profile.marqueeWeight;
    pushFactor(factors, 'marquee', 'Marquee teams', weightedMarqueeBoost);
    score += weightedMarqueeBoost;
  }
  // Upset bonus - non-marquee team defeating a marquee team signals a
  // Cinderella moment that amplifies entertainment value.
  if (marqueeBoost > 0 && game.status === 'final') {
    const marqueeTeams = MARQUEE_TEAMS[league] ?? MARQUEE_TEAMS[resolveLeague(league)];
    const homeIsMarquee = marqueeTeams?.has(normalizeTeamName(game.homeTeam)) ?? false;
    const awayIsMarquee = marqueeTeams?.has(normalizeTeamName(game.awayTeam)) ?? false;
    const homeWon = homeScore > awayScore;
    const winnerIsMarquee = (homeWon && homeIsMarquee) || (!homeWon && awayIsMarquee);
    if (!winnerIsMarquee) {
      const upsetDelta = 0.32;
      pushFactor(factors, 'upset', 'Underdog upset', upsetDelta);
      score += upsetDelta;
    }
  }
  // Narrative features from detection pipeline (BUZ-39)
  const narrativeDelta = applyNarrativeFactors(game.narratives, factors, league, rivalryBoost);
  score += narrativeDelta;
  const contextVariance = signatureVariance(game, profile.finalVarianceSpan);
  pushFactor(factors, 'context', 'Matchup context', contextVariance);
  score += contextVariance;
  let confidence = 0.72;
  if (game.status === 'final') {
    confidence += 0.12;
  } else if (game.status === 'in_progress') {
    confidence -= 0.06;
  }
  if (Math.max(homeScore, awayScore) <= 0) {
    confidence -= 0.2;
  } else {
    confidence += 0.06;
  }
  if (narrativeDelta > 0) {
    confidence += 0.04;
  }
  return {
    score: clampScore(score),
    baseline,
    confidence: clampUnit(confidence),
    factors: selectTopFactors(factors),
  };
}
function blendPredictedScore(engineScore: number, contextualScore: number): number {
  const blended = engineScore * 0.68 + contextualScore * 0.32;
  return clampScore(blended);
}
function canBlendWithContext(game: EntertainmentGameInput): boolean {
  const hasTeams =
    typeof game.homeTeam === 'string' &&
    game.homeTeam.length > 0 &&
    typeof game.awayTeam === 'string' &&
    game.awayTeam.length > 0;
  if (!hasTeams) {
    return false;
  }
  return resolveLocalStartHour(game) !== null;
}
function resolveBuzzScores(
  game: EntertainmentGameInput,
  options: BuzzScoreResolveOptions,
): ResolvedBuzzScores {
  const nowMs = resolveNowMs(options.now);
  const engineEntertainmentScore = normalizeScore(game.entertainmentScore);
  const enginePredictedScore = normalizeScore(game.predictedEntertainmentScore);
  const predictedEstimate = options.upcomingLike ? estimatePredictedBuzzScore(game, nowMs) : null;
  const completedEstimate = options.upcomingLike ? null : estimateCompletedBuzzScore(game);
  const canUseEnginePrediction = options.upcomingLike && enginePredictedScore != null;
  if (engineEntertainmentScore != null || canUseEnginePrediction) {
    let resolvedPredictedScore = canUseEnginePrediction ? enginePredictedScore : null;
    let diagnostics: BuzzScoreDiagnostics | null = null;
    if (options.upcomingLike) {
      if (
        resolvedPredictedScore != null &&
        predictedEstimate &&
        engineEntertainmentScore == null &&
        canBlendWithContext(game)
      ) {
        resolvedPredictedScore = blendPredictedScore(
          resolvedPredictedScore,
          predictedEstimate.score,
        );
      }
      if (resolvedPredictedScore != null && predictedEstimate) {
        diagnostics = {
          kind: 'predicted',
          score: resolvedPredictedScore,
          baseline: predictedEstimate.baseline,
          confidence: clampUnit(predictedEstimate.confidence + 0.08),
          factors: predictedEstimate.factors,
        };
      }
    } else if (engineEntertainmentScore != null && completedEstimate) {
      diagnostics = {
        kind: 'completed',
        score: engineEntertainmentScore,
        baseline: completedEstimate.baseline,
        confidence: clampUnit(completedEstimate.confidence + 0.08),
        factors: completedEstimate.factors,
      };
    }
    return {
      entertainmentScore: engineEntertainmentScore,
      predictedEntertainmentScore: resolvedPredictedScore,
      source: 'engine',
      modelLabel: ENGINE_MODEL_LABEL,
      diagnostics,
    };
  }
  const fallbackEntertainment = options.upcomingLike ? null : (completedEstimate?.score ?? null);
  const fallbackPrediction = options.upcomingLike ? (predictedEstimate?.score ?? null) : null;
  if (fallbackEntertainment != null || fallbackPrediction != null) {
    return {
      entertainmentScore: fallbackEntertainment,
      predictedEntertainmentScore: fallbackPrediction,
      source: 'lite',
      modelLabel: LITE_MODEL_LABEL,
      diagnostics: options.upcomingLike
        ? predictedEstimate
          ? {
              kind: 'predicted',
              score: predictedEstimate.score,
              baseline: predictedEstimate.baseline,
              confidence: predictedEstimate.confidence,
              factors: predictedEstimate.factors,
            }
          : null
        : completedEstimate
          ? {
              kind: 'completed',
              score: completedEstimate.score,
              baseline: completedEstimate.baseline,
              confidence: completedEstimate.confidence,
              factors: completedEstimate.factors,
            }
          : null,
    };
  }
  return {
    entertainmentScore: null,
    predictedEntertainmentScore: null,
    source: null,
    modelLabel: null,
    diagnostics: null,
  };
}
function isUpcomingLikeRow(row: BuzzGameRowInput, nowMs: number): boolean {
  if (row.status === 'in_progress') {
    return true;
  }
  if (row.status !== 'scheduled') {
    return false;
  }
  const startsAtMs = new Date(String(row.starts_at ?? '')).getTime();
  if (Number.isNaN(startsAtMs)) {
    return false;
  }
  return startsAtMs > nowMs;
}
function mapGameRowToBuzzInput(row: BuzzGameRowInput): EntertainmentGameInput {
  return {
    entertainmentScore: row.entertainment_score,
    predictedEntertainmentScore: row.predicted_entertainment_score,
    league: typeof row.league === 'string' ? row.league : undefined,
    status: typeof row.status === 'string' ? row.status : undefined,
    startsAt: typeof row.starts_at === 'string' ? row.starts_at : undefined,
    homeTeam: typeof row.home_team === 'string' ? row.home_team : undefined,
    awayTeam: typeof row.away_team === 'string' ? row.away_team : undefined,
    homeScore: typeof row.home_score === 'number' ? row.home_score : (row.home_score ?? null),
    awayScore: typeof row.away_score === 'number' ? row.away_score : (row.away_score ?? null),
    venueUtcOffsetMinutes:
      typeof row.venue_utc_offset_minutes === 'number' ? row.venue_utc_offset_minutes : null,
    localStartHour: typeof row.local_start_hour === 'number' ? row.local_start_hour : null,
  };
}
function enrichGameRowWithBuzzScores<TRow extends BuzzGameRowInput & Record<string, unknown>>(
  row: TRow,
  options: EnrichGameRowOptions = {},
): TRow & {
  entertainment_score: number | null;
  predicted_entertainment_score: number | null;
} {
  const nowMs = resolveNowMs(options.now);
  const upcomingLike = isUpcomingLikeRow(row, nowMs);
  const resolved = resolveBuzzScores(mapGameRowToBuzzInput(row), { upcomingLike, now: nowMs });
  return {
    ...row,
    entertainment_score: resolved.entertainmentScore,
    predicted_entertainment_score: upcomingLike ? resolved.predictedEntertainmentScore : null,
  };
}
const MUST_WATCH_THRESHOLD = 8.0;
function isMustWatch(score: number | null | undefined, threshold?: number): boolean {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return false;
  }
  return score >= (typeof threshold === 'number' ? threshold : MUST_WATCH_THRESHOLD);
}

export { resolveBuzzScores, enrichGameRowWithBuzzScores, isMustWatch, MUST_WATCH_THRESHOLD };
