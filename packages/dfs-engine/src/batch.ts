/**
 * v5 batch settlement — settle many entries in one call with a shared,
 * per-call memoized stat cache.
 *
 * `engine.settleEntries(inputs, context)` wraps the unchanged per-entry
 * settlement path. While a batch runs, stat-provider calls are memoized in
 * an internal Map keyed on a stable serialized
 * `(playerId|playerName, gameId|gameDate, league)` key, so legs across
 * entries that resolve through the same registered `StatProvider` for the
 * same player/game only invoke the provider once.
 *
 * Zero runtime dependencies, pure orchestration: no I/O of its own.
 */
import { DfsEngineInvariantError } from './errors';
import type { PlayerGameLogEntryShape } from './grading';
import type {
  DfsEntryInput,
  DfsLegInput,
  DfsSettlementContext,
  DfsSettlementResult,
  StatProvider,
  StatProviderGameLogInput,
  StatProviderRequest,
  StatProviderResult,
} from './engine';

/** Settlement context for a batch call, plus batch-only options. */
export type DfsBatchSettlementContext = DfsSettlementContext & {
  /**
   * How many entries settle concurrently. Defaults to 1 (sequential).
   * Cache dedup holds at any concurrency because in-flight provider
   * promises are memoized, not just resolved values.
   */
  concurrency?: number;
};

/** Stat-provider cache counters for one `settleEntries` call. */
export type DfsBatchCacheStats = {
  /** Number of actual provider invocations made during the batch. */
  providerCalls: number;
  /** Number of provider lookups served from the memo cache instead. */
  cacheHits: number;
};

/** One entry that threw during batch settlement (batch keeps going). */
export type DfsBatchEntryFailure = {
  entryId: string;
  /** Index of the failed entry in the `inputs` array. */
  index: number;
  error: Error;
};

/** Aggregate counts for one `settleEntries` call. */
export type DfsBatchSummary = {
  /** Number of input entries. */
  total: number;
  /** Results whose status is anything other than `pending`. */
  settled: number;
  /** Results whose status is `pending`. */
  pending: number;
  /** Entries that threw and were captured in `failures`. */
  failed: number;
};

/** Result of `engine.settleEntries(...)`. */
export type DfsBatchSettlementResult = {
  /**
   * Settlement results in the same order as their inputs. Entries that
   * threw are omitted here and reported in `failures` (with their index).
   */
  results: DfsSettlementResult[];
  failures: DfsBatchEntryFailure[];
  summary: DfsBatchSummary;
  cache: DfsBatchCacheStats;
};

/**
 * Internal seam the engine's stat-resolution path uses to route provider
 * calls through the batch memo cache. `settleEntry` passes no cache, so
 * single-entry behavior is untouched.
 */
export interface DfsBatchStatCache {
  extractStat(provider: StatProvider, request: StatProviderRequest): Promise<StatProviderResult>;
  getGameLog(
    provider: StatProvider,
    request: StatProviderGameLogInput,
  ): Promise<PlayerGameLogEntryShape[]>;
}

type ScopedBatchStatCache = DfsBatchStatCache & {
  /** Cache hits observed while settling one entry (drives `batch_cache_hit`). */
  readonly hitCount: number;
};

type BatchSettleFn = (
  input: DfsEntryInput,
  context: DfsSettlementContext,
  cache: DfsBatchStatCache,
) => Promise<DfsSettlementResult>;

/**
 * Stable serialized cache key for one leg: playerId (falling back to
 * lowercased playerName), gameId (falling back to gameDate), league.
 */
function legCacheKey(leg: DfsLegInput): string {
  const player = leg.playerId?.trim() || leg.playerName.trim().toLowerCase();
  const game = leg.gameId?.trim() || leg.gameDate?.trim() || '';
  const league = leg.league.trim().toUpperCase();
  return `${player}|${game}|${league}`;
}

function createBatchStatCache(): {
  stats: DfsBatchCacheStats;
  scope(): ScopedBatchStatCache;
} {
  const entries = new Map<string, Promise<unknown>>();
  const stats: DfsBatchCacheStats = { providerCalls: 0, cacheHits: 0 };

  function memo<T>(key: string, invoke: () => Promise<T>): { value: Promise<T>; hit: boolean } {
    const existing = entries.get(key);
    if (existing) {
      stats.cacheHits += 1;
      return { value: existing as Promise<T>, hit: true };
    }
    stats.providerCalls += 1;
    const value = invoke();
    entries.set(key, value);
    return { value, hit: false };
  }

  function scope(): ScopedBatchStatCache {
    let hitCount = 0;
    return {
      get hitCount() {
        return hitCount;
      },
      extractStat(provider, request) {
        // `extractStat` answers for one prop, so the prop type joins the
        // stable player/game/league key to keep memoized values correct.
        const key = `stat|${provider.id}|${legCacheKey(request.leg)}|${request.leg.propType}`;
        const { value, hit } = memo(key, async () => provider.extractStat!(request));
        if (hit) {
          hitCount += 1;
        }
        return value;
      },
      getGameLog(provider, request) {
        // Game logs are player/game scoped, so the spec key alone dedups
        // every prop for that player and game across the whole batch.
        const key = `log|${provider.id}|${legCacheKey(request.leg)}`;
        const { value, hit } = memo(key, async () => provider.getGameLog!(request));
        if (hit) {
          hitCount += 1;
        }
        return value;
      },
    };
  }

  return { stats, scope };
}

/**
 * Orchestrates one `settleEntries` call. Per-entry throws (engine
 * invariant errors, provider policy bugs) are captured as failures and
 * never abort the remaining entries.
 */
export async function runBatchSettlement(
  inputs: readonly DfsEntryInput[],
  context: DfsBatchSettlementContext,
  settle: BatchSettleFn,
): Promise<DfsBatchSettlementResult> {
  const { concurrency = 1, ...settlementContext } = context;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new DfsEngineInvariantError('settleEntries: concurrency must be a positive integer');
  }

  const cache = createBatchStatCache();
  const slots: Array<DfsSettlementResult | null> = new Array(inputs.length).fill(null);
  const failures: DfsBatchEntryFailure[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      const input = inputs[index];
      const scoped = cache.scope();
      try {
        const result = await settle(input, settlementContext, scoped);
        slots[index] =
          scoped.hitCount > 0 && !result.explanationCodes.includes('batch_cache_hit')
            ? {
                ...result,
                explanationCodes: [...result.explanationCodes, 'batch_cache_hit'],
              }
            : result;
      } catch (error) {
        failures.push({
          entryId: input.entryId,
          index,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, inputs.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const results = slots.filter((slot): slot is DfsSettlementResult => slot !== null);
  const pending = results.filter((result) => result.status === 'pending').length;
  failures.sort((a, b) => a.index - b.index);

  return {
    results,
    failures,
    summary: {
      total: inputs.length,
      settled: results.length - pending,
      pending,
      failed: failures.length,
    },
    cache: { ...cache.stats },
  };
}
