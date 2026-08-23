import { z } from 'zod';

/**
 * Accepts numbers or numeric strings (HTML form fields arrive as strings) and
 * rejects anything that is not finite. Without this, `parseFloat("abc")` reached
 * Prisma as NaN and surfaced as an opaque 500.
 */
const numeric = (label: string, min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .transform((v, ctx) => {
      const n = typeof v === 'number' ? v : parseFloat(v.trim());
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a number` });
        return z.NEVER;
      }
      return n;
    })
    .refine((n) => n >= min && n <= max, `${label} must be between ${min} and ${max}`);

const integerNumeric = (label: string, min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .transform((v, ctx) => {
      const n = typeof v === 'number' ? Math.trunc(v) : parseInt(String(v).trim(), 10);
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a whole number` });
        return z.NEVER;
      }
      return n;
    })
    .refine((n) => n >= min && n <= max, `${label} must be between ${min} and ${max}`);

const shortText = (label: string, max = 120) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`);

const DEGREE_LEVELS = ['HIGH_SCHOOL', 'BACHELORS', 'MASTERS', 'PHD', 'POSTDOC', 'SHORT_COURSE'] as const;

/** Language test scores, e.g. { IELTS: 7.5, TOEFL: 105 }. */
const languageTestsField = z
  .record(z.union([z.number(), z.string()]))
  .refine((obj) => Object.keys(obj).length <= 12, 'At most 12 language tests can be recorded')
  .refine((obj) => Object.keys(obj).every((k) => k.length <= 32), 'Language test names must be 32 characters or fewer');

export const updateProfileSchema = z.object({
  body: z
    .object({
      fullName: shortText('Full name').min(1, 'Full name is required').optional(),
      countryOfResidence: shortText('Country of residence').optional(),
      nationality: shortText('Nationality').optional(),
      currentDegreeLevel: z.enum(DEGREE_LEVELS).optional(),
      currentDegreeName: shortText('Current degree name').optional(),
      fieldOfStudy: shortText('Field of study').optional(),
      university: shortText('University', 200).optional(),
      gpa: numeric('GPA', 0, 100).optional(),
      maxGpa: numeric('Maximum GPA', 1, 100).optional(),
      graduationYear: integerNumeric('Graduation year', 1950, 2100).optional(),
      targetDegreeLevel: z.enum(DEGREE_LEVELS).optional(),
      targetCountries: z.array(shortText('Country')).max(25, 'At most 25 target countries').optional(),
      preferredFields: z.array(shortText('Field')).max(25, 'At most 25 preferred fields').optional(),
      languageTests: languageTestsField.optional(),
      financialPreference: shortText('Financial preference').optional(),
      scholarshipPreference: shortText('Scholarship preference').optional(),
      skills: z.array(shortText('Skill', 64)).max(100, 'At most 100 skills').optional(),
      workExperienceYears: numeric('Work experience years', 0, 70).optional(),
      researchExperience: z
        .string()
        .trim()
        .max(4000, 'Research experience must be 4000 characters or fewer')
        .optional(),
    })
    .strip()
    // GPA above its own scale is contradictory and would poison match scoring.
    .refine((data) => data.gpa === undefined || data.maxGpa === undefined || data.gpa <= data.maxGpa, {
      message: 'GPA cannot exceed the maximum GPA scale',
      path: ['gpa'],
    }),
});
