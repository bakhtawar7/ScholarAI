import { z } from 'zod';

const DEGREE_LEVELS = ['HIGH_SCHOOL', 'BACHELORS', 'MASTERS', 'PHD', 'POSTDOC', 'SHORT_COURSE'] as const;
const FUNDING_TYPES = ['FULL_FUNDING', 'PARTIAL_FUNDING', 'TUITION_ONLY', 'STIPEND_ONLY', 'TRAVEL_GRANT'] as const;
const VERIFICATION_STATUSES = [
  'VERIFIED',
  'PARTIALLY_VERIFIED',
  'UNVERIFIED',
  'NEEDS_REVIEW',
  'REJECTED',
  'PENDING_VERIFICATION',
  'EXPIRED',
] as const;

/** UUIDs are the only id format the catalogue issues. */
const idParam = z.string().uuid('A valid scholarship id is required');

/**
 * Only http(s) URLs are accepted. A bare z.string().url() also admits javascript:
 * and data: schemes, which would then be rendered as a clickable "Official Link".
 */
const httpUrl = z
  .string()
  .trim()
  .max(2048, 'URL is too long')
  .url('A valid URL is required')
  .refine((v) => /^https?:\/\//i.test(v), 'URL must use http or https');

export const scholarshipIdParamSchema = z.object({
  params: z.object({ id: idParam }),
});

export const scholarshipQuerySchema = z.object({
  query: z
    .object({
      q: z.string().trim().max(200).optional(),
      hostCountry: z.string().trim().max(100).optional(),
      country: z.string().trim().max(100).optional(),
      degreeLevel: z.string().trim().max(50).optional(),
      degree: z.string().trim().max(50).optional(),
      field: z.string().trim().max(100).optional(),
      fieldsOfStudy: z.string().trim().max(100).optional(),
      fundingType: z.string().trim().max(50).optional(),
      funding: z.string().trim().max(50).optional(),
      deadline: z.string().trim().max(50).optional(),
      deadlineBefore: z.string().trim().max(40).optional(),
      deadlineAfter: z.string().trim().max(40).optional(),
      nationality: z.string().trim().max(100).optional(),
      language: z.string().trim().max(50).optional(),
      minGpa: z.string().trim().max(10).optional(),
      verificationStatus: z.string().trim().max(40).optional(),
      verifiedStatus: z.string().trim().max(40).optional(),
      isDemo: z.string().trim().max(10).optional(),
      sortBy: z.string().trim().max(40).optional(),
      // Coerced and bounded here so the service never receives NaN or an unbounded page size.
      page: z.coerce.number().int().min(1).max(10_000).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(12),
    })
    .strip(),
});

export const verificationQueueQuerySchema = z.object({
  query: z
    .object({
      status: z.string().trim().max(40).optional(),
      page: z.coerce.number().int().min(1).max(10_000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .strip(),
});

const scholarshipBodyShape = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(300),
  provider: z.string().trim().min(2, 'Provider is required').max(200),
  university: z.string().trim().max(200).optional(),
  organization: z.string().trim().max(200).optional(),
  hostCountry: z.string().trim().min(2, 'Host country is required').max(100),
  degreeLevels: z.array(z.enum(DEGREE_LEVELS)).min(1, 'At least one degree level is required').max(10),
  fieldsOfStudy: z.array(z.string().trim().min(1).max(120)).min(1, 'At least one field of study is required').max(40),
  fundingType: z.enum(FUNDING_TYPES).default('FULL_FUNDING'),
  tuitionCoverage: z.string().trim().max(300).optional(),
  stipendAmount: z.string().trim().max(200).optional(),
  travelAllowance: z.boolean().default(false),
  accommodationCoverage: z.boolean().default(false),
  accommodationDetails: z.string().trim().max(1000).optional(),
  minGpa: z.number().min(0).max(100).optional(),
  maxGpaScale: z.number().min(1).max(100).default(4.0),
  gpaRequirements: z.string().trim().max(500).optional(),
  eligibleNationalities: z.array(z.string().trim().min(1).max(100)).max(250).default([]),
  nationalityRequirements: z.string().trim().max(1000).optional(),
  languageRequirements: z.record(z.union([z.string(), z.number()])).default({}),
  eligibilityDescription: z.string().trim().max(4000).optional(),
  requiredDocuments: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  applicationProcess: z.string().trim().min(10, 'Application process description is required').max(4000),
  deadline: z.string().trim().datetime({ offset: true }).or(z.string().trim().date()).nullable().optional(),
  officialUrl: httpUrl,
  sourceUrl: httpUrl.nullable().optional(),
  verificationStatus: z.enum(VERIFICATION_STATUSES).default('VERIFIED'),
  isDemo: z.boolean().default(true),
};

export const scholarshipCreateSchema = z.object({
  body: z
    .object(scholarshipBodyShape)
    .strip()
    .refine((d) => d.minGpa === undefined || d.minGpa <= d.maxGpaScale, {
      message: 'minGpa cannot exceed maxGpaScale',
      path: ['minGpa'],
    }),
});

/** Update accepts any subset of the create shape. */
export const scholarshipUpdateSchema = z.object({
  params: z.object({ id: idParam }),
  body: z
    .object(scholarshipBodyShape)
    .partial()
    .strip()
    .refine((d) => Object.keys(d).length > 0, 'At least one field must be provided'),
});

export const manualReviewSchema = z.object({
  params: z.object({ id: idParam }),
  body: z
    .object({
      status: z.enum(['VERIFIED', 'PARTIALLY_VERIFIED', 'NEEDS_REVIEW', 'REJECTED']),
      notes: z.string().trim().max(2000).optional(),
    })
    .strip(),
});

/**
 * Ad-hoc "what if my profile were…" eligibility check. Deliberately narrow: it must
 * not be usable to smuggle arbitrary keys into the matching engine.
 */
export const customEligibilitySchema = z.object({
  params: z.object({ id: idParam }),
  body: z
    .object({
      profile: z
        .object({
          targetDegreeLevel: z.enum(DEGREE_LEVELS).optional(),
          fieldOfStudy: z.string().trim().max(120).optional(),
          preferredFields: z.array(z.string().trim().max(120)).max(25).optional(),
          targetCountries: z.array(z.string().trim().max(100)).max(25).optional(),
          gpa: z.number().min(0).max(100).optional(),
          maxGpa: z.number().min(1).max(100).optional(),
          nationality: z.string().trim().max(100).optional(),
          countryOfResidence: z.string().trim().max(100).optional(),
          languageTests: z.record(z.union([z.string(), z.number()])).optional(),
          workExperienceYears: z.number().min(0).max(70).optional(),
        })
        .strip()
        .optional(),
    })
    .strip(),
});

/** Query params for the personalised sectioned view. */
export const personalisedQuerySchema = z.object({
  query: z
    .object({
      /** Cards per section. Bounded so a client cannot request the whole catalogue at once. */
      perSection: z.coerce.number().int().min(3).max(24).optional(),
    })
    .strip(),
});

/**
 * Body for an on-demand, country-scoped live search.
 *
 * The country string reaches a search provider and a model prompt, so it is bounded and
 * restricted to characters that appear in real place names — no newlines, no punctuation
 * that could be used to steer the extraction prompt.
 */
export const countryDiscoverySchema = z.object({
  body: z
    .object({
      country: z
        .string()
        .trim()
        .min(2, 'A country is required')
        .max(60, 'Country name is too long')
        .regex(/^[\p{L}\p{M}\s'.()-]+$/u, 'Enter a country name without special characters'),
      degreeLevel: z.enum(DEGREE_LEVELS).optional(),
      fieldOfStudy: z.string().trim().max(120).optional(),
    })
    .strip(),
});
