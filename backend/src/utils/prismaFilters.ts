import { Prisma } from '@prisma/client';

/**
 * Query helpers for the JSON-in-TEXT columns and for case handling across connectors.
 *
 * Two problems live here.
 *
 * 1. Case sensitivity is not portable. Prisma compiles `contains` to `LIKE`, and SQLite's
 *    LIKE is case-insensitive for ASCII while PostgreSQL's is not. `mode: 'insensitive'`
 *    fixes PostgreSQL but the SQLite connector *rejects* the argument outright, so it
 *    cannot simply be added everywhere. These helpers apply it only where it is valid.
 *
 * 2. Array-valued fields (degreeLevels, fieldsOfStudy, eligibleNationalities) are stored
 *    as serialised JSON in a TEXT column, so a plain `contains` is a raw substring test
 *    over the serialised form. That silently matches across element boundaries and inside
 *    longer elements: filtering nationality "Niger" matched a scholarship listing
 *    ["Nigeria"], and filtering field "Engineering" matched ["Chemical Engineering"].
 *
 *    The filter facets are built from exactly parsed element values
 *    (ScholarshipService.getFilterFacets), so a facet claiming 4 results was returning 9.
 *    Matching the JSON-quoted token instead restores element-exact semantics and makes
 *    facet counts agree with result counts.
 *
 * The long-term fix is native array columns on PostgreSQL (or join tables) rather than
 * JSON-in-TEXT; these helpers make the current storage behave correctly in the meantime.
 */

/**
 * Return type is declared structurally rather than as `Prisma.StringFilter`, because the
 * generated client's filter type is connector-specific: the SQLite build has no `mode`
 * property at all, so referencing it would not compile here even though it is required
 * on PostgreSQL. `Prisma.StringFilter` is still referenced below to keep this helper
 * pinned to the generated client's shape.
 */
export type PortableStringFilter = Prisma.StringFilter & {
  mode?: 'default' | 'insensitive';
};

function filter(f: { contains?: string; equals?: string }, insensitive: boolean): PortableStringFilter {
  return (insensitive ? { ...f, mode: 'insensitive' } : f) as PortableStringFilter;
}

/** Derived from DATABASE_URL rather than a separate setting, so it cannot drift out of sync. */
const isPostgres = /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || '');

export function usingPostgres(): boolean {
  return isPostgres;
}

/** Case-insensitive substring match. Use for free-text search over scalar columns. */
export function insensitiveContains(value: string): PortableStringFilter {
  return filter({ contains: value }, isPostgres);
}

/** Case-insensitive exact match. Use for facet values, which are already exact. */
export function insensitiveEquals(value: string): PortableStringFilter {
  return filter({ equals: value }, isPostgres);
}

/**
 * Matches one exact element of a serialised JSON string array.
 *
 * `JSON.stringify` produces the same quoted-and-escaped token the array was written with,
 * so `["Chemical Engineering"]` no longer matches a search for `Engineering`, while an
 * element containing a quote or backslash still matches correctly.
 *
 * Note this is still a substring test against the serialised text, so it cannot use an
 * index — the correctness fix is independent of the eventual storage fix.
 */
export function jsonArrayHasElement(value: string): PortableStringFilter {
  return insensitiveContains(JSON.stringify(String(value)));
}

/**
 * Matches one exact key of a serialised JSON object — `languageRequirements` is stored as
 * `{"IELTS":6.5}`, and JSON keys are always quoted, so the same token match applies.
 */
export function jsonObjectHasKey(key: string): PortableStringFilter {
  return insensitiveContains(JSON.stringify(String(key)));
}

/** An empty serialised array, i.e. "no restriction stated". */
export const EMPTY_JSON_ARRAY = '[]';
