import {
  createDfsEngine,
  DRAFT_BOOK_POLICY_FIXTURES,
  validateDfsEntryInput,
} from '@buzzr/dfs-engine';
import type {
  DfsBatchEntryFailure,
  DfsBookPolicy,
  DfsEntryInput,
  DfsLegInput,
  DfsSettlementContext,
} from '@buzzr/dfs-engine';
import { z } from 'zod';

import {
  boundedIdentifier,
  boundedLabel,
  finiteNumber,
  isoDateOrTimestamp,
  isoTimestamp,
  nonNegativeFiniteNumber,
  positiveFiniteNumber,
} from './schemas';
import { defineTool, jsonResult } from './shared';
import type { BuzzrToolDefinition } from './shared';

const legStatusSchema = z.enum([
  'pending',
  'won',
  'lost',
  'push',
  'dnp',
  'void',
  'rescued',
  'canceled',
  'manual',
]);

const legSchema = z.object({
  legId: boundedIdentifier.describe('Stable id for this leg, unique within the entry.'),
  playerId: boundedIdentifier.nullish().describe('Optional provider player id.'),
  playerName: boundedLabel.describe('Player display name, e.g. "LeBron James".'),
  team: boundedLabel.nullish(),
  opponent: boundedLabel.nullish(),
  gameId: boundedIdentifier.nullish(),
  gameDate: isoDateOrTimestamp
    .nullish()
    .describe('ISO date or timestamp for the game, e.g. "2026-07-06".'),
  league: boundedIdentifier.describe('League code, e.g. "NBA", "NFL", "MLB".'),
  propType: boundedIdentifier.describe('Prop market, e.g. "points", "rebounds", "pass_yards".'),
  line: finiteNumber.describe('The prop line, e.g. 25.5.'),
  direction: z.enum(['over', 'under']).describe('Which side of the line was picked.'),
  actual: finiteNumber
    .nullish()
    .describe('Observed stat value, when already known. Omit to leave the leg pending.'),
  status: legStatusSchema
    .nullish()
    .describe('Pre-graded leg status (e.g. "dnp" or "void") when the book already ruled it.'),
});

const entryFields = {
  entryId: boundedIdentifier.describe('Stable id for the entry being graded.'),
  bookId: boundedIdentifier.describe(
    'DFS book id, e.g. "prizepicks" or "underdog". See list_book_policies.',
  ),
  playTypeId: boundedIdentifier.describe(
    'Play type id for the book, e.g. "power", "flex", "underdog_standard".',
  ),
  stake: positiveFiniteNumber.describe('Entry stake in currency units.'),
  displayedMultiplier: positiveFiniteNumber.describe(
    'The payout multiplier the book displayed at entry time.',
  ),
  baseMultiplier: positiveFiniteNumber.nullish(),
  profitBoostPct: nonNegativeFiniteNumber.nullish(),
  placedAt: isoTimestamp.nullish().describe('ISO timestamp the entry was placed.'),
  legs: z.array(legSchema).min(1).max(12),
};

function requireUniqueLegIds(
  value: { legs: readonly { legId: string }[] },
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const [index, leg] of value.legs.entries()) {
    if (seen.has(leg.legId)) {
      context.addIssue({
        code: 'custom',
        path: ['legs', index, 'legId'],
        message: `Duplicate legId: ${leg.legId}`,
      });
    }
    seen.add(leg.legId);
  }
}

const actualsByLegIdSchema = z
  .record(boundedIdentifier, finiteNumber.nullable())
  .refine((actuals) => Object.keys(actuals).length <= 12, {
    message: 'actualsByLegId cannot contain more than 12 values.',
  });

const gradeDfsEntrySchema = z
  .object({
    ...entryFields,
    actualsByLegId: actualsByLegIdSchema
      .optional()
      .describe('Optional map of legId to observed stat value, merged in at settlement time.'),
  })
  .superRefine((value, context) => {
    requireUniqueLegIds(value, context);
    if (value.actualsByLegId) {
      const legIds = new Set(value.legs.map((leg) => leg.legId));
      for (const legId of Object.keys(value.actualsByLegId)) {
        if (!legIds.has(legId)) {
          context.addIssue({
            code: 'custom',
            path: ['actualsByLegId', legId],
            message: `actualsByLegId contains unknown legId: ${legId}`,
          });
        }
      }
    }
  });

const batchEntrySchema = z.object(entryFields).superRefine(requireUniqueLegIds);

type GradeDfsEntryArgs = z.output<typeof gradeDfsEntrySchema>;

function toDfsLegInput(leg: GradeDfsEntryArgs['legs'][number]): DfsLegInput {
  return {
    legId: leg.legId,
    playerId: leg.playerId ?? null,
    playerName: leg.playerName,
    team: leg.team ?? null,
    opponent: leg.opponent ?? null,
    gameId: leg.gameId ?? null,
    gameDate: leg.gameDate ?? null,
    league: leg.league,
    propType: leg.propType,
    line: leg.line,
    direction: leg.direction,
    actual: leg.actual ?? null,
    status: leg.status ?? null,
  };
}

function toDfsEntryInput(args: GradeDfsEntryArgs): DfsEntryInput {
  return {
    entryId: args.entryId,
    bookId: args.bookId,
    playTypeId: args.playTypeId,
    stake: args.stake,
    displayedMultiplier: args.displayedMultiplier,
    baseMultiplier: args.baseMultiplier ?? null,
    profitBoostPct: args.profitBoostPct ?? null,
    placedAt: args.placedAt ?? null,
    legs: args.legs.map(toDfsLegInput),
  };
}

/** Engine with only the built-in executable compatibility policies. */
function buildEngine() {
  return createDfsEngine();
}

export const gradeDfsEntryTool = defineTool({
  name: 'grade_dfs_entry',
  title: 'Grade DFS entry',
  description:
    'Settle a DFS pick-em entry (PrizePicks/Underdog style) with @buzzr/dfs-engine. ' +
    'Applies the book policy (ties, DNPs, flex payouts), returns the entry status, ' +
    'payout split, per-leg decisions, and explanation codes.',
  inputSchema: gradeDfsEntrySchema,
  run: async (args) => {
    const engine = buildEngine();
    const context: DfsSettlementContext | undefined = args.actualsByLegId
      ? { actualsByLegId: args.actualsByLegId }
      : undefined;
    const result = await engine.settleEntry(toDfsEntryInput(args), context);
    return jsonResult({ ...result, explanation: engine.explainSettlement(result) });
  },
});

const gradeDfsEntriesSchema = z
  .object({
    entries: z.array(batchEntrySchema).min(1).max(50),
    concurrency: z.number().int().min(1).max(8).optional(),
  })
  .superRefine((value, context) => {
    const entryIds = new Set<string>();
    let totalLegs = 0;
    for (const [index, entry] of value.entries.entries()) {
      totalLegs += entry.legs.length;
      if (entryIds.has(entry.entryId)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'entryId'],
          message: `Duplicate entryId: ${entry.entryId}`,
        });
      }
      entryIds.add(entry.entryId);
    }
    if (totalLegs > 600) {
      context.addIssue({
        code: 'custom',
        path: ['entries'],
        message: 'A batch cannot contain more than 600 total legs.',
      });
    }
  });

export function serializeBatchFailure(failure: DfsBatchEntryFailure) {
  return {
    entryId: failure.entryId,
    index: failure.index,
    error: {
      code: 'entry_settlement_failed',
      message: 'Entry settlement failed.',
    },
  };
}

export const gradeDfsEntriesTool = defineTool({
  name: 'grade_dfs_entries',
  title: 'Grade DFS entries',
  description:
    'Settle up to 50 DFS entries with @buzzr/dfs-engine batch settlement. ' +
    'Returns full explainable settlement results, isolated serializable failures, ' +
    'summary counts, and per-call stat-cache metrics.',
  inputSchema: gradeDfsEntriesSchema,
  run: async (args) => {
    const engine = buildEngine();
    const batch = await engine.settleEntries(args.entries.map(toDfsEntryInput), {
      concurrency: args.concurrency ?? 1,
    });
    return jsonResult({
      contractVersion: '1',
      results: batch.results.map((result) => ({
        ...result,
        explanation: engine.explainSettlement(result),
      })),
      failures: batch.failures.map(serializeBatchFailure),
      summary: batch.summary,
      cache: batch.cache,
    });
  },
});

const validateDfsEntrySchema = z.object({
  entry: z
    .record(boundedIdentifier, z.unknown())
    .refine((entry) => Object.keys(entry).length <= 1_000, {
      message: 'Entry objects cannot contain more than 1,000 top-level fields.',
    })
    .refine(
      (entry) => {
        try {
          return Buffer.byteLength(JSON.stringify(entry), 'utf8') <= 64 * 1_024;
        } catch {
          return false;
        }
      },
      { message: 'Entry payload cannot exceed 64 KiB of JSON.' },
    )
    .describe(
      'A candidate DfsEntryInput object (entryId, bookId, playTypeId, stake, ' +
        'displayedMultiplier, legs[]). Passed as-is to the engine validators so ' +
        'malformed entries return structured issues instead of schema rejections.',
    ),
});

export const validateDfsEntryTool = defineTool({
  name: 'validate_dfs_entry',
  title: 'Validate DFS entry',
  description:
    'Run the @buzzr/dfs-engine runtime validators against a candidate DFS entry. ' +
    'Returns ok plus structured error/warning issues (code, message, path, legIds) ' +
    'without settling anything.',
  inputSchema: validateDfsEntrySchema,
  run: (args) => {
    const validation = validateDfsEntryInput(args.entry);
    return jsonResult({
      ok: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings,
    });
  },
});

function describeDraftPolicy(policy: DfsBookPolicy) {
  return {
    id: policy.id,
    displayName: policy.displayName,
    version: policy.version,
    effectiveFrom: policy.effectiveFrom,
    status: policy.status,
    verification: policy.verification ?? null,
    sources: policy.sources,
    playTypes: policy.playTypes,
    executable: false as const,
    source: 'draft_fixture' as const,
  };
}

export const listBookPoliciesTool = defineTool({
  name: 'list_book_policies',
  title: 'List DFS book policies',
  description:
    'Enumerate registered executable DFS compatibility policies from the engine and ' +
    'published draft fixtures that are metadata-only. Includes version, effective date, ' +
    'verification, source references, complete play-type metadata, and executable status.',
  inputSchema: z.object({}),
  run: () => {
    const engine = buildEngine();
    const executableBooks = engine.getBookPolicies().map((policy) => ({
      ...policy,
      executable: true as const,
      source: 'engine_policy' as const,
    }));
    const draftBooks = DRAFT_BOOK_POLICY_FIXTURES.map(describeDraftPolicy);
    const books = [...executableBooks, ...draftBooks];

    return jsonResult({ count: books.length, books });
  },
});

export const dfsTools: readonly BuzzrToolDefinition[] = [
  gradeDfsEntryTool,
  gradeDfsEntriesTool,
  validateDfsEntryTool,
  listBookPoliciesTool,
];
