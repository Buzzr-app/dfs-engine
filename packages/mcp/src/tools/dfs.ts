import {
  createDfsEngine,
  DRAFT_BOOK_POLICY_FIXTURES,
  validateDfsEntryInput,
} from '@buzzr/dfs-engine';
import type {
  DfsBookPolicy,
  DfsEntryInput,
  DfsLegInput,
  DfsSettlementContext,
} from '@buzzr/dfs-engine';
import { z } from 'zod';

import { defineTool, jsonResult } from './shared';
import type { BuzzrToolDefinition } from './shared';

const americanNumber = z.number();

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
  legId: z.string().min(1).describe('Stable id for this leg, unique within the entry.'),
  playerId: z.string().nullish().describe('Optional provider player id.'),
  playerName: z.string().min(1).describe('Player display name, e.g. "LeBron James".'),
  team: z.string().nullish(),
  opponent: z.string().nullish(),
  gameId: z.string().nullish(),
  gameDate: z.string().nullish().describe('ISO date of the game, e.g. "2026-07-06".'),
  league: z.string().min(1).describe('League code, e.g. "NBA", "NFL", "MLB".'),
  propType: z.string().min(1).describe('Prop market, e.g. "points", "rebounds", "pass_yards".'),
  line: americanNumber.describe('The prop line, e.g. 25.5.'),
  direction: z.enum(['over', 'under']).describe('Which side of the line was picked.'),
  actual: americanNumber
    .nullish()
    .describe('Observed stat value, when already known. Omit to leave the leg pending.'),
  status: legStatusSchema
    .nullish()
    .describe('Pre-graded leg status (e.g. "dnp" or "void") when the book already ruled it.'),
});

const gradeDfsEntrySchema = z.object({
  entryId: z.string().min(1).describe('Stable id for the entry being graded.'),
  bookId: z
    .string()
    .min(1)
    .describe('DFS book id, e.g. "prizepicks" or "underdog". See list_book_policies.'),
  playTypeId: z
    .string()
    .min(1)
    .describe('Play type id for the book, e.g. "power", "flex", "underdog_standard".'),
  stake: z.number().positive().describe('Entry stake in currency units.'),
  displayedMultiplier: z
    .number()
    .positive()
    .describe('The payout multiplier the book displayed at entry time.'),
  baseMultiplier: z.number().positive().nullish(),
  profitBoostPct: z.number().min(0).nullish(),
  placedAt: z.string().nullish().describe('ISO timestamp the entry was placed.'),
  legs: z.array(legSchema).min(1),
  actualsByLegId: z
    .record(z.string(), z.number().nullable())
    .optional()
    .describe('Optional map of legId to observed stat value, merged in at settlement time.'),
});

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

/** Engine with the built-in stable books plus the published draft fixtures. */
function buildEngine() {
  return createDfsEngine({ bookPolicies: DRAFT_BOOK_POLICY_FIXTURES });
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
    return jsonResult({
      entryId: result.entryId,
      bookId: result.bookId,
      playTypeId: result.playTypeId,
      status: result.status,
      multiplier: result.multiplier,
      effectiveMultiplier: result.effectiveMultiplier,
      stake: result.stake,
      payout: result.payout,
      legs: result.legs,
      adjustments: result.adjustments,
      pendingReasons: result.pendingReasons,
      explanationCodes: result.explanationCodes,
      confidence: result.confidence,
      policyVersion: result.policyVersion,
    });
  },
});

const validateDfsEntrySchema = z.object({
  entry: z
    .record(z.string(), z.unknown())
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

/**
 * Play-type metadata for the engine's built-in stable policies. The engine's
 * public API exposes registered book ids (getRegisteredBooks) but not the
 * built-in policy objects themselves, so this mirrors the ids/display names of
 * the built-ins shipped in @buzzr/dfs-engine v5.
 */
const BUILT_IN_POLICY_SUMMARIES: readonly {
  id: string;
  displayName: string;
  status: string;
  playTypes: { id: string; displayName: string }[];
}[] = [
  {
    id: 'prizepicks',
    displayName: 'PrizePicks',
    status: 'stable',
    playTypes: [
      { id: 'power', displayName: 'Power Play' },
      { id: 'flex', displayName: 'Flex Play' },
    ],
  },
  {
    id: 'underdog',
    displayName: 'Underdog',
    status: 'stable',
    playTypes: [
      { id: 'underdog_standard', displayName: 'Standard' },
      { id: 'underdog_flex', displayName: 'Flex' },
    ],
  },
];

function describePolicy(policy: DfsBookPolicy) {
  return {
    id: policy.id,
    displayName: policy.displayName,
    status: policy.status,
    version: policy.version,
    source: 'draft_fixture' as const,
    playTypes: policy.playTypes.map((playType) => ({
      id: playType.id,
      displayName: playType.displayName,
      payoutModel: playType.payoutModel,
      pickCount: playType.pickCount,
      allOrNothing: playType.allOrNothing ?? false,
      flex: playType.flex ?? false,
    })),
  };
}

export const listBookPoliciesTool = defineTool({
  name: 'list_book_policies',
  title: 'List DFS book policies',
  description:
    'Enumerate the DFS books the settlement engine knows: built-in stable policies ' +
    '(PrizePicks, Underdog) plus the published draft fixtures, with play types and ' +
    'policy status. Use the ids here as bookId/playTypeId for grade_dfs_entry.',
  inputSchema: z.object({}),
  run: () => {
    const engine = buildEngine();
    const registeredIds = engine.getRegisteredBooks();
    const draftsById = new Map(DRAFT_BOOK_POLICY_FIXTURES.map((policy) => [policy.id, policy]));
    const builtInsById = new Map(BUILT_IN_POLICY_SUMMARIES.map((summary) => [summary.id, summary]));

    const books = registeredIds.map((id) => {
      const draft = draftsById.get(id);
      if (draft) {
        return describePolicy(draft);
      }
      const builtIn = builtInsById.get(id);
      if (builtIn) {
        return { ...builtIn, source: 'built_in' as const };
      }
      return { id, displayName: id, status: 'unknown', source: 'engine' as const, playTypes: [] };
    });

    return jsonResult({ count: books.length, books });
  },
});

export const dfsTools: readonly BuzzrToolDefinition[] = [
  gradeDfsEntryTool,
  validateDfsEntryTool,
  listBookPoliciesTool,
];
