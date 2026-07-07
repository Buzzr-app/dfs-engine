/**
 * DRAFT / EXPERIMENTAL — Kalshi-style binary-contract settlement policy.
 *
 * This models prediction-market contract semantics on top of the book
 * policy registry: an entry holds exactly one binary contract leg, priced
 * in cents per contract (1..99) via entry metadata `contractPrice`.
 *
 * - win  → pays `stake * (100 / contractPrice)` (each 1-dollar contract
 *          bought at `contractPrice` cents settles at $1)
 * - loss → pays 0
 * - tie / DNP / void → the leg is removed; with no survivors the engine
 *          refunds the stake (standard no-survivor refund path)
 *
 * It ships with `status: 'draft'` and is NOT registered by default.
 * Opt in exactly like the other draft fixtures:
 *
 * ```ts
 * import { createDfsEngine, KALSHI_DRAFT_BOOK_POLICY } from '@buzzr/dfs-engine';
 * const engine = createDfsEngine({ bookPolicies: [KALSHI_DRAFT_BOOK_POLICY] });
 * ```
 *
 * Only type-only imports from '../engine' here — the runtime dependency
 * points the other way (engine wraps this definition in defineBookPolicy),
 * which keeps the module graph acyclic.
 */
import { DfsEngineInvariantError } from '../errors';
import type { DfsBookPolicy, DfsEntryInput } from '../engine';

/** Metadata key holding the contract price in cents per contract (1..99). */
export const KALSHI_CONTRACT_PRICE_METADATA_KEY = 'contractPrice';

/**
 * Reads and validates `entry.metadata.contractPrice` (cents per contract,
 * 1..99). Throws `DfsEngineInvariantError` when absent or out of range —
 * a binary contract cannot be priced without it.
 */
export function resolveKalshiContractPrice(entry: DfsEntryInput): number {
  const raw = entry.metadata?.[KALSHI_CONTRACT_PRICE_METADATA_KEY];
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1 || raw > 99) {
    throw new DfsEngineInvariantError(
      'kalshi payoutResolver: entry.metadata.contractPrice must be a number of cents between 1 and 99',
    );
  }
  return raw;
}

/**
 * Raw draft policy definition. Prefer the frozen, validated
 * `KALSHI_DRAFT_BOOK_POLICY` export (built via `defineBookPolicy`).
 */
export const KALSHI_DRAFT_POLICY_DEFINITION: DfsBookPolicy = {
  id: 'kalshi',
  displayName: 'Kalshi',
  version: 'draft-2026-07',
  effectiveFrom: '2026-07-01',
  status: 'draft',
  sources: [
    {
      label: 'Kalshi-style binary contract settlement semantics',
      note: 'Draft/experimental prediction-market contract profile; not registered by default.',
    },
  ],
  playTypes: [
    {
      id: 'binary',
      displayName: 'Binary Contract',
      payoutModel: 'custom',
      pickCount: { min: 1, max: 1 },
    },
  ],
  tiePolicy: { type: 'push' },
  dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
  pushPolicy: { type: 'remove_leg', refundIfNoSurvivors: true },
  payoutSplit: { type: 'all_withdrawable' },
  validation: { duplicatePlayers: 'warn', sameTeam: 'allow', sameGame: 'allow' },
  payoutResolver: ({ entry, hits, pickCount }) => {
    const contractPrice = resolveKalshiContractPrice(entry);
    const multiplier = hits === pickCount ? 100 / contractPrice : 0;
    return {
      multiplier,
      explanationCode: 'settlement.kalshi_binary_contract',
      confidence: 'medium',
    };
  },
};
