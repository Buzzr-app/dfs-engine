import { describe, expect, test } from 'vitest';
import {
  createDfsEngine,
  KALSHI_CONTRACT_PRICE_METADATA_KEY,
  KALSHI_DRAFT_BOOK_POLICY,
  resolveKalshiContractPrice,
  type DfsEntryInput,
} from '../src';

const contractEntry = (
  overrides: Partial<DfsEntryInput> = {},
  contractPrice: number | null = 40,
): DfsEntryInput => ({
  entryId: 'kalshi-entry-1',
  bookId: 'kalshi',
  playTypeId: 'binary',
  stake: 10,
  displayedMultiplier: 3,
  metadata:
    contractPrice === null
      ? {}
      : { [KALSHI_CONTRACT_PRICE_METADATA_KEY]: contractPrice },
  legs: [
    {
      legId: 'contract-1',
      playerName: 'Market: FED-RATE-CUT-JUL',
      league: 'NBA',
      propType: 'Points',
      line: 0.5,
      direction: 'over',
      gameDate: '2026-07-01T00:00:00.000Z',
    },
  ],
  ...overrides,
});

const engine = () => createDfsEngine({ bookPolicies: [KALSHI_DRAFT_BOOK_POLICY] });

describe('v5 kalshi draft binary-contract policy', () => {
  test('a won contract pays stake * (100 / contractPrice), all withdrawable', async () => {
    const settlement = await engine().settleEntry(contractEntry(), {
      legStatusesByLegId: { 'contract-1': 'won' },
      actualsByLegId: { 'contract-1': 1 },
    });

    expect(settlement.status).toBe('won');
    // 10 * (100 / 40) = 25.
    expect(settlement.payout.total).toBeCloseTo(25, 6);
    expect(settlement.payout.withdrawable).toBeCloseTo(25, 6);
    expect(settlement.payout.bonus).toBe(0);
    expect(settlement.explanationCodes).toContain(
      'settlement.kalshi_binary_contract',
    );
  });

  test('a lost contract pays zero', async () => {
    const settlement = await engine().settleEntry(contractEntry(), {
      legStatusesByLegId: { 'contract-1': 'lost' },
      actualsByLegId: { 'contract-1': 0 },
    });

    expect(settlement.status).toBe('lost');
    expect(settlement.payout.total).toBe(0);
  });

  test('resolveKalshiContractPrice rejects missing or out-of-range prices', () => {
    for (const bad of [null, 0, 100, -5, Number.NaN]) {
      expect(() =>
        resolveKalshiContractPrice(contractEntry({}, bad as number | null)),
      ).toThrowError(/contractPrice/);
    }
    expect(resolveKalshiContractPrice(contractEntry({}, 1))).toBe(1);
    expect(resolveKalshiContractPrice(contractEntry({}, 99))).toBe(99);
  });

  test('the draft policy is not registered by default', async () => {
    const bare = createDfsEngine({});
    const settlement = await bare.settleEntry(contractEntry(), {
      legStatusesByLegId: { 'contract-1': 'won' },
      actualsByLegId: { 'contract-1': 1 },
    });

    // Without the kalshi policy the engine falls back to generic pricing:
    // no contract-pricing explanation code, and the payout follows the
    // displayed multiplier (10 * 3 = 30) instead of 100/contractPrice (25).
    expect(settlement.explanationCodes).not.toContain(
      'settlement.kalshi_binary_contract',
    );
    expect(settlement.payout.total).not.toBeCloseTo(25, 6);
  });
});
