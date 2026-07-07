/**
 * v5 declarative book-policy validation.
 *
 * `validateBookPolicyDefinition(...)` checks a candidate book-policy object
 * WITHOUT registering it, returning the same structured issue format as
 * `validateDfsEntryInput` (machine-readable codes, paths, severities)
 * instead of the thrown `DfsDefinitionError`s that `defineBookPolicy`
 * raises on the first violation.
 *
 * The rule list mirrors `defineBookPolicy` in src/engine.ts — keep the two
 * in sync when policy invariants change. `defineBookPolicy` itself is a
 * locked v4 contract and is intentionally untouched.
 */
import type { DfsBookPolicy } from './engine';
import type { DfsValidationIssue, DfsValidationResult } from './validators';

const POLICY_STATUSES = ['stable', 'draft', 'experimental'] as const;
const PAYOUT_MODELS = ['fixed-table', 'displayed-multiplier', 'custom'] as const;

/**
 * Validates a candidate book-policy definition without registering it.
 *
 * Returns `{ ok: true, value }` when the object would pass
 * `defineBookPolicy`, or `{ ok: false, errors }` with machine-readable
 * issue codes such as `policy.playtypes_empty`, `policy.invalid_pick_count`,
 * and `policy.unknown_payout_model`.
 */
export function validateBookPolicyDefinition(
  definition: unknown,
): DfsValidationResult<DfsBookPolicy> {
  if (!isPlainObject(definition)) {
    return invalid([
      issue(
        'policy.object_required',
        `Expected a book policy object, got ${describe(definition)}.`,
        undefined,
      ),
    ]);
  }

  const errors: DfsValidationIssue[] = [];
  const policy = definition;

  if (typeof policy.id !== 'string' || !policy.id.trim()) {
    errors.push(issue('policy.id_required', 'id is required.', 'id'));
  }
  if (typeof policy.displayName !== 'string' || !policy.displayName.trim()) {
    errors.push(issue('policy.display_name_required', 'displayName is required.', 'displayName'));
  }
  if (typeof policy.version !== 'string' || !policy.version.trim()) {
    errors.push(issue('policy.version_required', 'version is required.', 'version'));
  }
  if (typeof policy.effectiveFrom !== 'string' || !policy.effectiveFrom.trim()) {
    errors.push(
      issue('policy.effective_from_required', 'effectiveFrom is required.', 'effectiveFrom'),
    );
  } else if (!isValidDate(policy.effectiveFrom)) {
    errors.push(
      issue(
        'policy.invalid_effective_from',
        'effectiveFrom must be a parseable date.',
        'effectiveFrom',
      ),
    );
  }
  if (!POLICY_STATUSES.includes(policy.status as (typeof POLICY_STATUSES)[number])) {
    errors.push(
      issue(
        'policy.invalid_status',
        `status must be one of ${POLICY_STATUSES.join(', ')}.`,
        'status',
      ),
    );
  }

  validatePlayTypes(policy, errors);
  validateSources(policy, errors);

  return errors.length
    ? invalid(errors)
    : { ok: true, value: definition as unknown as DfsBookPolicy, errors: [], warnings: [] };
}

function validatePlayTypes(policy: Record<string, unknown>, errors: DfsValidationIssue[]): void {
  const playTypes = policy.playTypes;
  if (!Array.isArray(playTypes) || playTypes.length === 0) {
    errors.push(
      issue(
        'policy.playtypes_empty',
        'playTypes must be a non-empty array of play types.',
        'playTypes',
      ),
    );
    return;
  }

  const seenIds = new Set<string>();
  playTypes.forEach((candidate, index) => {
    const path = `playTypes.${index}`;
    if (!isPlainObject(candidate)) {
      errors.push(issue('policy.invalid_play_type', `playTypes.${index} must be an object.`, path));
      return;
    }
    const id = candidate.id;
    const hasId = typeof id === 'string' && id.trim().length > 0;
    if (!hasId || typeof candidate.displayName !== 'string' || !candidate.displayName.trim()) {
      errors.push(
        issue('policy.invalid_play_type', `playTypes.${index} needs an id and displayName.`, path),
      );
    }
    if (hasId) {
      if (seenIds.has(id)) {
        errors.push(
          issue('policy.duplicate_play_type', `Duplicate play type id "${id}".`, `${path}.id`),
        );
      }
      seenIds.add(id);
    }
    if (!PAYOUT_MODELS.includes(candidate.payoutModel as (typeof PAYOUT_MODELS)[number])) {
      errors.push(
        issue(
          'policy.unknown_payout_model',
          `payoutModel must be one of ${PAYOUT_MODELS.join(', ')}.`,
          `${path}.payoutModel`,
        ),
      );
    }
    const pickCount = candidate.pickCount;
    if (
      !isPlainObject(pickCount) ||
      !Number.isInteger(pickCount.min) ||
      !Number.isInteger(pickCount.max) ||
      (pickCount.min as number) < 1 ||
      (pickCount.max as number) < (pickCount.min as number)
    ) {
      errors.push(
        issue(
          'policy.invalid_pick_count',
          'pickCount needs integer min >= 1 and max >= min.',
          `${path}.pickCount`,
        ),
      );
    }
    if (candidate.payoutModel === 'custom' && typeof policy.payoutResolver !== 'function') {
      errors.push(
        issue(
          'policy.missing_payout_resolver',
          'A custom payout model requires a payoutResolver function.',
          'payoutResolver',
        ),
      );
    }
  });
}

function validateSources(policy: Record<string, unknown>, errors: DfsValidationIssue[]): void {
  const sources = policy.sources;
  if (!Array.isArray(sources)) {
    errors.push(
      issue('policy.invalid_sources', 'sources must be an array of source refs.', 'sources'),
    );
    return;
  }
  sources.forEach((source, index) => {
    const path = `sources.${index}`;
    if (!isPlainObject(source) || typeof source.label !== 'string' || !source.label.trim()) {
      errors.push(
        issue('policy.invalid_source', `sources.${index} needs a non-empty label.`, path),
      );
      return;
    }
    if (
      source.retrievedAt != null &&
      (typeof source.retrievedAt !== 'string' || !isValidDate(source.retrievedAt))
    ) {
      errors.push(
        issue(
          'policy.invalid_source_retrieved_at',
          `sources.${index}.retrievedAt must be a parseable date.`,
          `${path}.retrievedAt`,
        ),
      );
    }
  });
}

function issue(code: string, message: string, path: string | undefined): DfsValidationIssue {
  return { code, message, severity: 'error', path };
}

function invalid<T>(errors: DfsValidationIssue[]): DfsValidationResult<T> {
  return { ok: false, errors, warnings: [] };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function describe(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}
