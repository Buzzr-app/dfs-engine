/**
 * Runtime validators for public DFS input shapes.
 *
 * These stay dependency-free on purpose: the engine is a tiny settlement
 * package, so boundary safety is handwritten and deterministic.
 */
import type { PlayerGameLogEntryShape } from './grading';
import type { DfsBetLeg, DfsBoostType, DfsLegStatus } from './types';
import type { DfsEntryInput, DfsLegInput, DfsSettlementContext } from './engine';
import { DfsEngineInvariantError } from './errors';

export type DfsValidationIssue = {
  code: string;
  message: string;
  severity: 'warning' | 'error';
  path?: string;
  legIds?: string[];
};

export type DfsValidationResult<T = unknown> =
  | { ok: true; value: T; errors: []; warnings: DfsValidationIssue[] }
  | { ok: false; errors: DfsValidationIssue[]; warnings: DfsValidationIssue[]; value?: undefined };

export type ValidationResult<T> = DfsValidationResult<T>;

export function validatePlayerGameLogEntryShape(
  entry: unknown,
): DfsValidationResult<PlayerGameLogEntryShape> {
  const errors: DfsValidationIssue[] = [];
  if (!isPlainObject(entry)) {
    return invalid([
      issue('validation.object_required', 'Expected object, got ' + describe(entry), undefined),
    ]);
  }
  const e = entry;

  for (const key of REQUIRED_GAMELOG_FIELDS) {
    if (typeof e[key] !== 'string') {
      errors.push(
        issue(
          'validation.field_string',
          `field "${key}": expected string, got ${describe(e[key])}`,
          key,
        ),
      );
    }
  }

  if ('mlbRole' in e && e.mlbRole != null && !['batter', 'pitcher'].includes(e.mlbRole as string)) {
    errors.push(
      issue(
        'validation.mlb_role_invalid',
        `field "mlbRole": expected 'batter' | 'pitcher' | null, got ${describe(e.mlbRole)}`,
        'mlbRole',
      ),
    );
  }
  if (
    'nhlPosition' in e &&
    e.nhlPosition != null &&
    !['skater', 'goalie'].includes(e.nhlPosition as string)
  ) {
    errors.push(
      issue(
        'validation.nhl_position_invalid',
        `field "nhlPosition": expected 'skater' | 'goalie' | null, got ${describe(e.nhlPosition)}`,
        'nhlPosition',
      ),
    );
  }
  if ('mlbExtras' in e && e.mlbExtras != null && !isPlainObject(e.mlbExtras)) {
    errors.push(
      issue(
        'validation.mlb_extras_object',
        `field "mlbExtras": expected object or undefined, got ${describe(e.mlbExtras)}`,
        'mlbExtras',
      ),
    );
  }
  if ('categories' in e && e.categories != null && !isPlainObject(e.categories)) {
    errors.push(
      issue(
        'validation.categories_object',
        `field "categories": expected object or undefined, got ${describe(e.categories)}`,
        'categories',
      ),
    );
  }

  return errors.length ? invalid(errors) : valid(entry as unknown as PlayerGameLogEntryShape);
}

export function validateDfsBetLeg(leg: unknown): DfsValidationResult<DfsBetLeg> {
  const errors: DfsValidationIssue[] = [];
  if (!isPlainObject(leg)) {
    return invalid([
      issue('validation.object_required', 'Expected object, got ' + describe(leg), undefined),
    ]);
  }
  const l = leg;

  requireNonEmptyString(l.legId, 'legId', errors);
  if (!isLegStatus(l.legStatus)) {
    errors.push(
      issue(
        'validation.leg_status_invalid',
        `field "legStatus": expected 'pending' | 'won' | 'lost' | 'push' | 'dnp', got ${describe(l.legStatus)}`,
        'legStatus',
      ),
    );
  }
  requireString(l.playerName, 'playerName', errors);
  requireString(l.propType, 'propType', errors);
  requireFiniteNumber(l.line, 'line', 'validation.line_finite', errors);
  if (l.direction !== 'over' && l.direction !== 'under') {
    errors.push(
      issue(
        'validation.direction_invalid',
        `field "direction": expected 'over' | 'under'`,
        'direction',
      ),
    );
  }
  requireNonEmptyString(l.league, 'league', errors);
  if (!isBoostType(l.boostType)) {
    errors.push(
      issue(
        'validation.boost_type_invalid',
        `field "boostType": expected 'standard' | 'demon' | 'goblin', got ${describe(l.boostType)}`,
        'boostType',
      ),
    );
  }

  return errors.length ? invalid(errors) : valid(leg as DfsBetLeg);
}

export function validateDfsLegInput(leg: unknown): DfsValidationResult<DfsLegInput> {
  const errors: DfsValidationIssue[] = [];
  if (!isPlainObject(leg)) {
    return invalid([
      issue('validation.object_required', 'Expected object, got ' + describe(leg), undefined),
    ]);
  }
  const l = leg;

  requireNonEmptyString(l.legId, 'legId', errors);
  requireNonEmptyString(l.playerName, 'playerName', errors);
  requireNonEmptyString(l.league, 'league', errors);
  requireNonEmptyString(l.propType, 'propType', errors);
  requireFiniteNumber(l.line, 'line', 'validation.line_finite', errors);
  if (l.direction !== 'over' && l.direction !== 'under') {
    errors.push(
      issue(
        'validation.direction_invalid',
        `field "direction": expected 'over' | 'under'`,
        'direction',
      ),
    );
  }
  if ('stat' in l) {
    errors.push(
      issue('validation.legacy_field', 'Use canonical "actual" instead of legacy "stat".', 'stat'),
    );
  }
  if ('legStatus' in l) {
    errors.push(
      issue(
        'validation.legacy_field',
        'Use canonical "status" instead of legacy "legStatus".',
        'legStatus',
      ),
    );
  }
  if ('actual' in l && l.actual != null) {
    requireFiniteNumber(l.actual, 'actual', 'validation.actual_finite', errors);
  }
  if ('status' in l && l.status != null && !isLegOutcome(l.status)) {
    errors.push(
      issue(
        'validation.status_invalid',
        `field "status": invalid value ${describe(l.status)}`,
        'status',
      ),
    );
  }
  for (const key of ['playerId', 'team', 'opponent', 'gameId', 'gameDate'] as const) {
    if (key in l && l[key] != null && typeof l[key] !== 'string') {
      errors.push(issue('validation.field_string', `field "${key}": expected string or null`, key));
    }
  }
  if (typeof l.gameDate === 'string' && l.gameDate.trim() && !isValidDate(l.gameDate)) {
    errors.push(issue('validation.timestamp_invalid', 'gameDate must be parseable.', 'gameDate'));
  }
  if ('metadata' in l && l.metadata != null && !isPlainObject(l.metadata)) {
    errors.push(issue('validation.metadata_object', 'metadata must be an object.', 'metadata'));
  }
  if ('providerData' in l && l.providerData != null) {
    errors.push(
      ...prefixIssues(validatePlayerGameLogEntryShape(l.providerData).errors, 'providerData'),
    );
  }

  return errors.length ? invalid(errors) : valid(leg as DfsLegInput);
}

export function validateDfsEntryInput(entry: unknown): DfsValidationResult<DfsEntryInput> {
  const errors: DfsValidationIssue[] = [];
  if (!isPlainObject(entry)) {
    return invalid([
      issue('validation.object_required', 'Expected object, got ' + describe(entry), undefined),
    ]);
  }
  const e = entry;

  requireNonEmptyString(e.entryId, 'entryId', errors);
  requireNonEmptyString(e.bookId, 'bookId', errors);
  requireNonEmptyString(e.playTypeId, 'playTypeId', errors);
  requirePositiveNumber(e.stake, 'stake', 'validation.stake_positive', errors);
  requirePositiveNumber(
    e.displayedMultiplier,
    'displayedMultiplier',
    'validation.displayed_multiplier_positive',
    errors,
  );
  if ('baseMultiplier' in e && e.baseMultiplier != null) {
    requirePositiveNumber(
      e.baseMultiplier,
      'baseMultiplier',
      'validation.base_multiplier_positive',
      errors,
    );
  }
  if ('profitBoostPct' in e && e.profitBoostPct != null) {
    requireNonNegativeNumber(
      e.profitBoostPct,
      'profitBoostPct',
      'validation.profit_boost_pct_non_negative',
      errors,
    );
  }
  if ('placedAt' in e && e.placedAt != null) {
    if (typeof e.placedAt !== 'string' || !isValidDate(e.placedAt)) {
      errors.push(issue('validation.timestamp_invalid', 'placedAt must be parseable.', 'placedAt'));
    }
  }
  if ('metadata' in e && e.metadata != null && !isPlainObject(e.metadata)) {
    errors.push(issue('validation.metadata_object', 'metadata must be an object.', 'metadata'));
  }
  if (!Array.isArray(e.legs)) {
    errors.push(issue('validation.legs_array', 'legs must be an array.', 'legs'));
  } else {
    const seen = new Map<string, number>();
    e.legs.forEach((candidate, index) => {
      const result = validateDfsLegInput(candidate);
      errors.push(...prefixIssues(result.errors, `legs.${index}`));
      if (
        isPlainObject(candidate) &&
        typeof candidate.legId === 'string' &&
        candidate.legId.trim()
      ) {
        const previousIndex = seen.get(candidate.legId);
        if (previousIndex != null) {
          errors.push({
            code: 'validation.duplicate_leg_id',
            message: `Duplicate legId "${candidate.legId}" is not allowed.`,
            severity: 'error',
            path: `legs.${index}.legId`,
            legIds: [candidate.legId],
          });
          errors.push({
            code: 'validation.duplicate_leg_id',
            message: `Duplicate legId "${candidate.legId}" is not allowed.`,
            severity: 'error',
            path: `legs.${previousIndex}.legId`,
            legIds: [candidate.legId],
          });
        }
        seen.set(candidate.legId, index);
      }
    });
  }

  return errors.length ? invalid(errors) : valid(entry as DfsEntryInput);
}

export function validateDfsSettlementContext(
  context: unknown,
): DfsValidationResult<DfsSettlementContext> {
  const errors: DfsValidationIssue[] = [];
  if (context == null) {
    return valid({} as DfsSettlementContext);
  }
  if (!isPlainObject(context)) {
    return invalid([
      issue('validation.object_required', 'Expected object, got ' + describe(context), undefined),
    ]);
  }
  const c = context;

  if ('statsByLegId' in c) {
    errors.push(
      issue(
        'validation.legacy_field',
        'Use canonical "actualsByLegId" instead of legacy "statsByLegId".',
        'statsByLegId',
      ),
    );
  }
  if ('legStatusByLegId' in c) {
    errors.push(
      issue(
        'validation.legacy_field',
        'Use canonical "legStatusesByLegId" instead of legacy "legStatusByLegId".',
        'legStatusByLegId',
      ),
    );
  }
  if ('settledAt' in c && c.settledAt != null) {
    if (typeof c.settledAt !== 'string' || !isValidDate(c.settledAt)) {
      errors.push(
        issue('validation.timestamp_invalid', 'settledAt must be parseable.', 'settledAt'),
      );
    }
  }
  validateNumberMap(c.actualsByLegId, 'actualsByLegId', errors);
  validateStatusMap(c.legStatusesByLegId, 'legStatusesByLegId', errors);
  validateProviderDataMap(c.providerDataByLegId, 'providerDataByLegId', errors);
  if ('actualEntry' in c && c.actualEntry != null) {
    errors.push(
      ...prefixIssues(validatePlayerGameLogEntryShape(c.actualEntry).errors, 'actualEntry'),
    );
  }
  for (const key of ['providerId', 'statProviderId', 'auditId', 'auditRunId'] as const) {
    if (key in c && c[key] != null && typeof c[key] !== 'string') {
      errors.push(issue('validation.field_string', `${key} must be a string.`, key));
    }
  }
  if ('metadata' in c && c.metadata != null && !isPlainObject(c.metadata)) {
    errors.push(issue('validation.metadata_object', 'metadata must be an object.', 'metadata'));
  }

  return errors.length ? invalid(errors) : valid(context as DfsSettlementContext);
}

export function assertValidDfsEntryInput(input: unknown): asserts input is DfsEntryInput {
  const result = validateDfsEntryInput(input);
  if (!result.ok) {
    throw new DfsEngineInvariantError(
      `Invalid DFS entry input: ${result.errors.map((item) => item.path ?? item.code).join(', ')}`,
    );
  }
}

const REQUIRED_GAMELOG_FIELDS = [
  'date',
  'minutes',
  'points',
  'rebounds',
  'assists',
  'steals',
  'blocks',
  'turnovers',
  'threeP',
] as const;

const LEG_STATUSES: readonly DfsLegStatus[] = ['pending', 'won', 'lost', 'push', 'dnp'];
const LEG_OUTCOMES = [
  'pending',
  'won',
  'lost',
  'push',
  'dnp',
  'void',
  'rescued',
  'canceled',
  'manual',
] as const;
const BOOST_TYPES: readonly DfsBoostType[] = ['standard', 'demon', 'goblin'];

function valid<T>(value: T, warnings: DfsValidationIssue[] = []): DfsValidationResult<T> {
  return { ok: true, value, errors: [], warnings };
}

function invalid<T>(
  errors: DfsValidationIssue[],
  warnings: DfsValidationIssue[] = [],
): DfsValidationResult<T> {
  return { ok: false, errors, warnings };
}

function issue(code: string, message: string, path: string | undefined): DfsValidationIssue {
  return { code, message, severity: 'error', path };
}

function prefixIssues(issues: readonly DfsValidationIssue[], prefix: string): DfsValidationIssue[] {
  return issues.map((item) => ({
    ...item,
    path: item.path ? `${prefix}.${item.path}` : prefix,
  }));
}

function requireString(value: unknown, path: string, errors: DfsValidationIssue[]): void {
  if (typeof value !== 'string') {
    errors.push(issue('validation.field_string', `field "${path}": expected string`, path));
  }
}

function requireNonEmptyString(value: unknown, path: string, errors: DfsValidationIssue[]): void {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(issue(`validation.${toSnake(path)}_required`, `${path} is required.`, path));
  }
}

function requireFiniteNumber(
  value: unknown,
  path: string,
  code: string,
  errors: DfsValidationIssue[],
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(issue(code, `${path} must be a finite number.`, path));
  }
}

function requirePositiveNumber(
  value: unknown,
  path: string,
  code: string,
  errors: DfsValidationIssue[],
): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    errors.push(issue(code, `${path} must be a finite positive number.`, path));
  }
}

function requireNonNegativeNumber(
  value: unknown,
  path: string,
  code: string,
  errors: DfsValidationIssue[],
): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    errors.push(issue(code, `${path} must be a finite non-negative number.`, path));
  }
}

function validateNumberMap(value: unknown, path: string, errors: DfsValidationIssue[]): void {
  if (value == null) return;
  if (!isPlainObject(value)) {
    errors.push(issue('validation.map_object', `${path} must be an object.`, path));
    return;
  }
  for (const [key, actual] of Object.entries(value)) {
    if (actual != null && (typeof actual !== 'number' || !Number.isFinite(actual))) {
      errors.push(
        issue('validation.actual_finite', `${path}.${key} must be finite.`, `${path}.${key}`),
      );
    }
  }
}

function validateStatusMap(value: unknown, path: string, errors: DfsValidationIssue[]): void {
  if (value == null) return;
  if (!isPlainObject(value)) {
    errors.push(issue('validation.map_object', `${path} must be an object.`, path));
    return;
  }
  for (const [key, status] of Object.entries(value)) {
    if (status != null && !isLegOutcome(status)) {
      errors.push(
        issue('validation.status_invalid', `${path}.${key} is invalid.`, `${path}.${key}`),
      );
    }
  }
}

function validateProviderDataMap(value: unknown, path: string, errors: DfsValidationIssue[]): void {
  if (value == null) return;
  if (!isPlainObject(value)) {
    errors.push(issue('validation.map_object', `${path} must be an object.`, path));
    return;
  }
  for (const [key, row] of Object.entries(value)) {
    if (row != null) {
      errors.push(...prefixIssues(validatePlayerGameLogEntryShape(row).errors, `${path}.${key}`));
    }
  }
}

function isLegStatus(v: unknown): v is DfsLegStatus {
  return typeof v === 'string' && (LEG_STATUSES as readonly string[]).includes(v);
}

function isLegOutcome(v: unknown): boolean {
  return typeof v === 'string' && (LEG_OUTCOMES as readonly string[]).includes(v);
}

function isBoostType(v: unknown): v is DfsBoostType {
  return typeof v === 'string' && (BOOST_TYPES as readonly string[]).includes(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function isValidDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function toSnake(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return `array(length=${v.length})`;
  return typeof v;
}
