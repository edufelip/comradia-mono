// Typed readers for unknown callable `data`, in the spirit of ruleset.ts: every branch
// throws an HttpsError with the field name so the admin UI can show it inline.
import { HttpsError } from 'firebase-functions/v2/https';

export type UnknownRecord = { [key: string]: unknown };

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function reqRecord(data: unknown, path = 'request'): UnknownRecord {
  if (!isRecord(data)) {
    throw new HttpsError('invalid-argument', `${path} must be an object.`);
  }
  return data;
}

export function reqString(
  record: UnknownRecord,
  key: string,
  options: { min: number; max?: number } = { min: 1 },
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length < options.min) {
    throw new HttpsError('invalid-argument', `${key} must be a string of at least ${options.min} characters.`);
  }
  const trimmed = value.trim();
  if (options.max !== undefined && trimmed.length > options.max) {
    throw new HttpsError('invalid-argument', `${key} must be at most ${options.max} characters.`);
  }
  return trimmed;
}

export function reqInt(
  record: UnknownRecord,
  key: string,
  options: { min: number; max?: number; nonzero?: boolean },
): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < options.min) {
    throw new HttpsError('invalid-argument', `${key} must be an integer >= ${options.min}.`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new HttpsError('invalid-argument', `${key} must be an integer <= ${options.max}.`);
  }
  if (options.nonzero === true && value === 0) {
    throw new HttpsError('invalid-argument', `${key} must not be 0.`);
  }
  return value;
}

export function optionalString(
  record: UnknownRecord,
  key: string,
  options: { min: number; max?: number } = { min: 1 },
): string | undefined {
  if (record[key] === undefined) return undefined;
  return reqString(record, key, options);
}
