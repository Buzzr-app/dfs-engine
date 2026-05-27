import type { DfsLegDecision, DfsLegOutcome, DfsSettlementResult } from '@buzzr/dfs-engine';

export type SlipStatusTone = 'win' | 'loss' | 'push' | 'pending' | 'void';

export type LegDisplayModel = {
  legId: string;
  label: string;
  line: string;
  status: DfsLegOutcome;
  tone: SlipStatusTone;
  actual: number | null;
  pendingReason: string | null;
};

export type SlipDisplayModel = {
  entryId: string;
  bookId: string;
  playTypeId: string;
  statusLabel: string;
  tone: SlipStatusTone;
  multiplierLabel: string;
  payoutLabel: string;
  stakeLabel: string;
  legs: LegDisplayModel[];
  pendingReasons: string[];
};

export function getStatusTone(status: string): SlipStatusTone {
  switch (status) {
    case 'won':
      return 'win';
    case 'lost':
      return 'loss';
    case 'push':
    case 'pushed':
      return 'push';
    case 'pending':
      return 'pending';
    case 'void':
    case 'canceled':
    case 'rescued':
    case 'manual':
    case 'dnp':
      return 'void';
    default:
      return 'pending';
  }
}

export function formatLegLabel(leg: DfsLegDecision): string {
  return `${leg.playerName} — ${leg.propType}`;
}

export function formatLegLine(leg: DfsLegDecision): string {
  const arrow = leg.direction === 'over' ? 'o' : 'u';
  return `${arrow}${leg.line}`;
}

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUsd(amount: number): string {
  return USD.format(amount);
}

function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`;
}

export function getSlipDisplayModel(result: DfsSettlementResult): SlipDisplayModel {
  const tone = getStatusTone(result.status);
  return {
    entryId: result.entryId,
    bookId: String(result.bookId),
    playTypeId: String(result.playTypeId),
    statusLabel: result.status,
    tone,
    multiplierLabel: formatMultiplier(result.effectiveMultiplier),
    payoutLabel: formatUsd(result.payout.total),
    stakeLabel: formatUsd(result.stake),
    legs: result.legs.map((leg) => ({
      legId: leg.legId,
      label: formatLegLabel(leg),
      line: formatLegLine(leg),
      status: leg.status,
      tone: getStatusTone(leg.status),
      actual: leg.actual,
      pendingReason: leg.pendingReason ?? null,
    })),
    pendingReasons: [...result.pendingReasons],
  };
}
