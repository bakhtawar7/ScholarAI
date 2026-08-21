import { parseJsonField } from './jsonHelper';

/**
 * Converts a StudentProfile row into its API shape.
 *
 * SQLite has no native array/JSON column, so `targetCountries`, `preferredFields`,
 * `skills` and `languageTests` are stored as JSON strings. Every endpoint that returns
 * a profile must parse them, or clients receive `"[]"` where the contract promises `[]`
 * and any array method on the value throws.
 *
 * Shared by AuthService (register/login/me) and ProfileService so the two can never
 * drift apart again.
 */
export function formatStudentProfile<T extends Record<string, any> | null | undefined>(profile: T) {
  if (!profile) return null;

  return {
    ...profile,
    targetCountries: parseJsonField<string[]>(profile.targetCountries, []),
    preferredFields: parseJsonField<string[]>(profile.preferredFields, []),
    skills: parseJsonField<string[]>(profile.skills, []),
    languageTests: parseJsonField<Record<string, any>>(profile.languageTests, {}),
  };
}
