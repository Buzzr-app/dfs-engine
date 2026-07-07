export * from './types';
export {
  americanOddsToImpliedProbability,
  calculateEdgePercent,
  calculateNoVigFairLine,
  probabilityToAmericanOdds,
} from './odds';
export { calculateBetRollup } from './rollup';
export * from './parlay';
export * from './value';
export * from './analytics';

import type {
  BetLeg,
  BetRecord,
  DfsEntryAdapterOptions,
  DfsEntryInput,
  DfsLegInput,
  ExternalBetKeyInput,
} from './types';
import {
  assertFiniteNumber,
  assertNonNegativeNumber,
  assertPositiveNumber,
  round,
} from './internal';

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
