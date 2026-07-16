import { z } from 'zod';

export const MAX_IDENTIFIER_LENGTH = 128;
export const MAX_LABEL_LENGTH = 200;
export const MAX_FINITE_MAGNITUDE = 1_000_000_000;

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
