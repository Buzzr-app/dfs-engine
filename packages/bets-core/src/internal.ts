/**
 * Package-private helpers shared across modules. Nothing in this file is
 * re-exported from the package entry point.
 *
 * The assert helpers default to throwing plain `Error` (the v4 behavior the
 * existing exports rely on). v5 modules pass `TypeError` so new APIs surface
 * invalid caller input as `TypeError` with the same message wording.
 */

type ErrorCtor = new (message?: string) => Error;

export function assertFiniteNumber(
  value: number,
  label: string,
  errorCtor: ErrorCtor = Error,
): void {
  if (!Number.isFinite(value)) {
    throw new errorCtor(`${label} must be a finite number`);
  }
}

export function assertPositiveNumber(
  value: number,
  label: string,
  errorCtor: ErrorCtor = Error,
): void {
  assertFiniteNumber(value, label, errorCtor);
  if (value <= 0) {
    throw new errorCtor(`${label} must be a positive number`);
  }
}

export function assertNonNegativeNumber(
  value: number,
  label: string,
  errorCtor: ErrorCtor = Error,
): void {
  assertFiniteNumber(value, label, errorCtor);
  if (value < 0) {
    throw new errorCtor(`${label} must be a non-negative number`);
  }
}

export function assertProbability(
  value: number,
  label: string,
  errorCtor: ErrorCtor = Error,
): void {
  assertFiniteNumber(value, label, errorCtor);
  if (value <= 0 || value >= 1) {
    throw new errorCtor(`${label} must be between 0 and 1`);
  }
}

export function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
