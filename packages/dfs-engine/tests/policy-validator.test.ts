import { describe, expect, test } from 'vitest';
import { KALSHI_DRAFT_POLICY_DEFINITION, validateBookPolicyDefinition } from '../src';

const validPolicy = () => ({
  ...KALSHI_DRAFT_POLICY_DEFINITION,
  playTypes: KALSHI_DRAFT_POLICY_DEFINITION.playTypes.map((playType) => ({
    ...playType,
  })),
});

function codes(result: ReturnType<typeof validateBookPolicyDefinition>): string[] {
  return result.ok ? [] : result.errors.map((issue) => issue.code);
}

describe('v5 validateBookPolicyDefinition', () => {
  test('accepts a policy that defineBookPolicy would accept', () => {
    const result = validateBookPolicyDefinition(validPolicy());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects non-object candidates with policy.object_required', () => {
    for (const candidate of [null, undefined, 42, 'policy', []]) {
      expect(codes(validateBookPolicyDefinition(candidate))).toContain('policy.object_required');
    }
  });

  test('reports missing identity fields individually', () => {
    const result = validateBookPolicyDefinition({
      ...validPolicy(),
      id: '',
      displayName: '  ',
      version: undefined,
    });
    const found = codes(result);
    expect(found).toContain('policy.id_required');
    expect(found).toContain('policy.display_name_required');
    expect(found).toContain('policy.version_required');
  });

  test('rejects unparseable effectiveFrom dates', () => {
    const result = validateBookPolicyDefinition({
      ...validPolicy(),
      effectiveFrom: 'not-a-date',
    });
    expect(codes(result)).toContain('policy.invalid_effective_from');
  });

  test('rejects unknown status values', () => {
    const result = validateBookPolicyDefinition({
      ...validPolicy(),
      status: 'beta',
    });
    expect(codes(result)).toContain('policy.invalid_status');
  });

  test('validates optional policy verification metadata', () => {
    expect(
      codes(
        validateBookPolicyDefinition({
          ...validPolicy(),
          verification: { status: 'trusted', reviewedAt: '2026-07-16' },
        }),
      ),
    ).toContain('policy.invalid_verification_status');
    expect(
      codes(
        validateBookPolicyDefinition({
          ...validPolicy(),
          verification: { status: 'partial', reviewedAt: 'not-a-date' },
        }),
      ),
    ).toContain('policy.invalid_verification_reviewed_at');
  });

  test('rejects empty play type lists', () => {
    const result = validateBookPolicyDefinition({
      ...validPolicy(),
      playTypes: [],
    });
    expect(codes(result)).toContain('policy.playtypes_empty');
  });

  test('rejects invalid pick counts and unknown payout models', () => {
    const base = validPolicy();
    const result = validateBookPolicyDefinition({
      ...base,
      playTypes: [
        {
          id: 'binary',
          displayName: 'Binary Contract',
          payoutModel: 'jackpot',
          pickCount: { min: 0, max: -1 },
        },
      ],
    });
    const found = codes(result);
    expect(found).toContain('policy.unknown_payout_model');
    expect(found).toContain('policy.invalid_pick_count');
  });

  test('rejects duplicate play type ids', () => {
    const base = validPolicy();
    const playType = base.playTypes[0];
    const result = validateBookPolicyDefinition({
      ...base,
      playTypes: [playType, { ...playType }],
    });
    expect(codes(result)).toContain('policy.duplicate_play_type');
  });

  test('requires a payoutResolver for custom payout models', () => {
    const result = validateBookPolicyDefinition({
      ...validPolicy(),
      payoutResolver: undefined,
    });
    expect(codes(result)).toContain('policy.missing_payout_resolver');
  });

  test('validates source refs', () => {
    const base = validPolicy();
    expect(codes(validateBookPolicyDefinition({ ...base, sources: 'espn' }))).toContain(
      'policy.invalid_sources',
    );
    expect(codes(validateBookPolicyDefinition({ ...base, sources: [{ label: '' }] }))).toContain(
      'policy.invalid_source',
    );
    expect(
      codes(
        validateBookPolicyDefinition({
          ...base,
          sources: [{ label: 'ok', retrievedAt: 'yesterday-ish' }],
        }),
      ),
    ).toContain('policy.invalid_source_retrieved_at');
  });
});
