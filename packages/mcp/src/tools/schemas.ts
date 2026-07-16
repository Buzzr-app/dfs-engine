import { z } from 'zod';

export const MAX_IDENTIFIER_LENGTH = 128;
export const MAX_LABEL_LENGTH = 200;
export const MAX_FINITE_MAGNITUDE = 1_000_000_000;

export const americanOdds = z
  .number()
  .finite()
  .min(-100_000)
  .max(100_000)
  .refine((value) => value <= -100 || value >= 100, {
    message: 'American odds must be at most -100 or at least +100.',
  });

export const boundedIdentifier = z.string().min(1).max(MAX_IDENTIFIER_LENGTH);
export const boundedLabel = z.string().min(1).max(MAX_LABEL_LENGTH);
export const finiteNumber = z
  .number()
  .finite()
  .min(-MAX_FINITE_MAGNITUDE)
  .max(MAX_FINITE_MAGNITUDE);
export const nonNegativeFiniteNumber = finiteNumber.min(0);
export const positiveFiniteNumber = finiteNumber.positive();
export const isoTimestamp = z.iso.datetime({ offset: true });
export const isoDateOrTimestamp = z.union([z.iso.date(), isoTimestamp]);

/**
 * Checks the container size before validating its items. This keeps an
 * oversized adversarial array from generating an unbounded Zod issue list.
 */
export function boundedArray<Schema extends z.ZodType>(
  itemSchema: Schema,
  maximum: number,
  minimum = 0,
) {
  return z
    .array(z.unknown())
    .min(minimum)
    .max(maximum)
    .pipe(z.array(itemSchema).min(minimum).max(maximum));
}

/** Checks record cardinality before validating keys and values. */
export function boundedRecord<KeySchema extends z.ZodType<string>, ValueSchema extends z.ZodType>(
  keySchema: KeySchema,
  valueSchema: ValueSchema,
  maximum: number,
  label: string,
) {
  return z
    .record(z.string(), z.unknown())
    .refine((value) => Object.keys(value).length <= maximum, {
      message: `${label} cannot contain more than ${maximum} entries.`,
    })
    .pipe(z.record(keySchema, valueSchema));
}
