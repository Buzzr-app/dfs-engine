import type { DfsEngine, DfsEntryInput, DfsSettlementResult } from '../src';

const legacyEntry: DfsEntryInput = {
  entryId: 'legacy-entry',
  bookId: 'prizepicks',
  playTypeId: 'power',
  stake: 10,
  displayedMultiplier: 3,
  legs: [],
};

// A v5.0 consumer must be able to keep constructing the original settlement
// shape without supplying metadata introduced by a backwards-compatible minor.
const legacySettlementResult: DfsSettlementResult = {
  entryId: legacyEntry.entryId,
  bookId: legacyEntry.bookId,
  playTypeId: legacyEntry.playTypeId,
  status: 'pending',
  multiplier: 0,
  effectiveMultiplier: 0,
  payout: { total: 0, withdrawable: 0, bonus: 0 },
  stake: legacyEntry.stake,
  displayedMultiplier: legacyEntry.displayedMultiplier,
  legs: [],
  adjustments: [],
  pendingReasons: [],
  policyVersion: null,
  sourceRefs: [],
  confidence: 'low',
  explanationCodes: [],
  validation: { ok: true, value: legacyEntry, errors: [], warnings: [] },
  provenance: { providers: [], settledAt: '2026-07-16T00:00:00.000Z' },
  auditTrail: [],
};

// A v5.0 external engine implementation must remain assignable without
// implementing policy-snapshot discovery added by a minor release.
const legacyExternalEngine: DfsEngine = {
  normalizeEntry(input) {
    return input;
  },
  extractLegStat() {
    throw new Error('not implemented in compatibility fixture');
  },
  gradeLeg() {
    throw new Error('not implemented in compatibility fixture');
  },
  lookupPayout() {
    throw new Error('not implemented in compatibility fixture');
  },
  validateEntry() {
    throw new Error('not implemented in compatibility fixture');
  },
  settleEntry() {
    throw new Error('not implemented in compatibility fixture');
  },
  settleEntries() {
    throw new Error('not implemented in compatibility fixture');
  },
  explainSettlement() {
    throw new Error('not implemented in compatibility fixture');
  },
  registerBookPolicy() {
    throw new Error('not implemented in compatibility fixture');
  },
  registerPayoutTable() {
    throw new Error('not implemented in compatibility fixture');
  },
  registerLeagueAdapter() {
    throw new Error('not implemented in compatibility fixture');
  },
  registerStatProvider() {
    throw new Error('not implemented in compatibility fixture');
  },
  getRegisteredBooks() {
    return [];
  },
};

void legacySettlementResult;
void legacyExternalEngine;
