const DEGREE_LEVELS = ['HIGH_SCHOOL', 'BACHELORS', 'MASTERS', 'PHD', 'POSTDOC', 'SHORT_COURSE'];
const FUNDING_TYPES = ['FULL_FUNDING', 'PARTIAL_FUNDING', 'TUITION_ONLY', 'STIPEND_ONLY', 'TRAVEL_GRANT'];

/**
 * Search query parameters.
 *
 * Several filters accept two names because the client has historically sent either
 * (`country`/`hostCountry`, `degree`/`degreeLevel`, `field`/`fieldsOfStudy`,
 * `funding`/`fundingType`, `verifiedStatus`/`verificationStatus`). Both are honoured.
 */
const searchQueryParameters = [
  { name: 'q', in: 'query', schema: { type: 'string', maxLength: 200 }, description: 'Free-text search across title, provider, university, organisation, host country, fields of study and eligibility text.' },
  { name: 'hostCountry', in: 'query', schema: { type: 'string', maxLength: 100 }, description: 'Host country. Alias of `country`.' },
  { name: 'country', in: 'query', schema: { type: 'string', maxLength: 100 }, description: 'Host country. Alias of `hostCountry`.' },
  { name: 'degreeLevel', in: 'query', schema: { type: 'string', enum: DEGREE_LEVELS }, description: 'Degree level. Alias of `degree`.' },
  { name: 'degree', in: 'query', schema: { type: 'string', enum: DEGREE_LEVELS }, description: 'Degree level. Alias of `degreeLevel`.' },
  { name: 'field', in: 'query', schema: { type: 'string', maxLength: 100 }, description: 'Field of study. Alias of `fieldsOfStudy`.' },
  { name: 'fieldsOfStudy', in: 'query', schema: { type: 'string', maxLength: 100 }, description: 'Field of study. Alias of `field`.' },
  { name: 'fundingType', in: 'query', schema: { type: 'string', enum: FUNDING_TYPES }, description: 'Funding type. Alias of `funding`.' },
  { name: 'funding', in: 'query', schema: { type: 'string', enum: FUNDING_TYPES }, description: 'Funding type. Alias of `fundingType`.' },
  { name: 'deadline', in: 'query', schema: { type: 'string', maxLength: 50 }, description: 'Deadline window shorthand.' },
  { name: 'deadlineBefore', in: 'query', schema: { type: 'string', maxLength: 40 }, description: 'Only deadlines on or before this ISO date.' },
  { name: 'deadlineAfter', in: 'query', schema: { type: 'string', maxLength: 40 }, description: 'Only deadlines on or after this ISO date.' },
  { name: 'nationality', in: 'query', schema: { type: 'string', maxLength: 100 }, description: 'Restrict to scholarships open to this nationality.' },
  { name: 'language', in: 'query', schema: { type: 'string', maxLength: 50 }, description: 'Language requirement filter.' },
  { name: 'minGpa', in: 'query', schema: { type: 'string', maxLength: 10 }, description: 'Exclude scholarships demanding more than this GPA.' },
  { name: 'verificationStatus', in: 'query', schema: { type: 'string', maxLength: 40 }, description: 'Verification status. Alias of `verifiedStatus`.' },
  { name: 'verifiedStatus', in: 'query', schema: { type: 'string', maxLength: 40 }, description: 'Verification status. Alias of `verificationStatus`.' },
  { name: 'isDemo', in: 'query', schema: { type: 'string', maxLength: 10 }, description: 'Filter seeded demo records in or out.' },
  { name: 'sortBy', in: 'query', schema: { type: 'string', maxLength: 40 }, description: 'Sort key. Match-based sorting requires a session and is windowed to the most recent matches.' },
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 10000, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 12 } },
] as const;

export const scholarshipPaths = {
  '/api/scholarships': {
    get: {
      tags: ['Scholarships'],
      summary: 'Search and filter scholarships',
      description: [
        'Public browsing is intentional — a bearer token is optional and only enriches the',
        'result, adding `userMatch`, `isSaved` and `applicationStatus` per item.',
      ].join('\n'),
      security: [{ bearerAuth: [] }, {}],
      parameters: searchQueryParameters,
      responses: {
        200: {
          description: 'Paginated results plus the facet values for the filter UI.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ScholarshipSearchResult' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    post: {
      tags: ['Scholarships'],
      summary: 'Create a scholarship (admin)',
      description: 'Catalogue mutation is restricted to administrator accounts.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ScholarshipWriteRequest' } } },
      },
      responses: {
        201: {
          description: 'Created.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Scholarship' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        409: { $ref: '#/components/responses/Conflict' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/scholarships/filters': {
    get: {
      tags: ['Scholarships'],
      summary: 'Filter facets',
      description: 'Distinct countries, funding types, degree levels, fields and verification statuses. Cached for five minutes.',
      security: [],
      responses: {
        200: {
          description: 'Facet values.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ScholarshipFilterFacets' } } },
        },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/scholarships/{id}': {
    get: {
      tags: ['Scholarships'],
      summary: 'Get one scholarship',
      description: 'Includes verification history and sources. A bearer token adds `userMatch`, `isSaved` and `applicationStatus`.',
      security: [{ bearerAuth: [] }, {}],
      parameters: [{ $ref: '#/components/parameters/ScholarshipId' }],
      responses: {
        200: {
          description: 'The scholarship.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Scholarship' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    put: {
      tags: ['Scholarships'],
      summary: 'Update a scholarship (admin)',
      description: 'Accepts any non-empty subset of the create shape.',
      parameters: [{ $ref: '#/components/parameters/ScholarshipId' }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ScholarshipWriteRequest' } } },
      },
      responses: {
        200: {
          description: 'Updated.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Scholarship' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    delete: {
      tags: ['Scholarships'],
      summary: 'Delete a scholarship (admin)',
      parameters: [{ $ref: '#/components/parameters/ScholarshipId' }],
      responses: {
        200: {
          description: 'Deleted.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/scholarships/{id}/eligibility': {
    get: {
      tags: ['Eligibility'],
      summary: 'Eligibility assessment for this scholarship',
      description: [
        'With a bearer token the result is computed against the caller\'s saved profile and',
        'cached per profile hash. Without one, the scholarship\'s own criteria are returned',
        'evaluated against an empty profile.',
        '',
        'The score is an advisory estimate, never an eligibility decision.',
      ].join('\n'),
      security: [{ bearerAuth: [] }, {}],
      parameters: [
        { $ref: '#/components/parameters/ScholarshipId' },
        {
          name: 'forceRefresh',
          in: 'query',
          schema: { type: 'boolean' },
          description: 'Bypass the cached match and recompute. `refresh` is accepted as an alias.',
        },
      ],
      responses: {
        200: {
          description: 'Assessment.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MatchEvaluation' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/scholarships/{id}/eligibility/evaluate': {
    post: {
      tags: ['Eligibility'],
      summary: 'Evaluate a hypothetical profile',
      description:
        'Runs the deterministic compatibility engine against a supplied profile without persisting anything — a "what if my GPA were…" check. Nothing is saved and no cached match is written.',
      security: [{ bearerAuth: [] }, {}],
      parameters: [{ $ref: '#/components/parameters/ScholarshipId' }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomEligibilityRequest' } } },
      },
      responses: {
        200: {
          description: 'Assessment for the supplied profile.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MatchEvaluation' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/scholarships/match/recalculate': {
    post: {
      tags: ['Recommendations'],
      summary: 'Recalculate the caller\'s matches',
      description: 'Rebuilds every cached match for the signed-in user. Rate limited to 6 requests per minute.',
      responses: {
        200: {
          description: 'Recalculated.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RecalculateMatchesResponse' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/scholarships/verification/queue': {
    get: {
      tags: ['Verification'],
      summary: 'Verification queue (admin)',
      description:
        'Administrator-only: the queue exposes crawler payloads, source URLs and reviewer identities.',
      parameters: [
        { name: 'status', in: 'query', schema: { type: 'string', maxLength: 40 }, description: 'Filter by verification status.' },
        { $ref: '#/components/parameters/Page' },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
      ],
      responses: {
        200: {
          description: 'Paginated queue.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  totalPages: { type: 'integer' },
                  items: { type: 'array', items: { type: 'object', additionalProperties: true } },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/scholarships/{id}/verification': {
    get: {
      tags: ['Verification'],
      summary: 'Verification audit trail (admin)',
      parameters: [{ $ref: '#/components/parameters/ScholarshipId' }],
      responses: {
        200: {
          description: 'Audit history for this scholarship.',
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/scholarships/{id}/verify': {
    post: {
      tags: ['Verification'],
      summary: 'Trigger a verification re-audit (admin)',
      description:
        'Re-runs the verification agent, which may fetch the official page and call the model. Admin-only and additionally rate limited as an AI-heavy route.',
      parameters: [{ $ref: '#/components/parameters/ScholarshipId' }],
      responses: {
        200: {
          description: 'Verification result.',
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/scholarships/{id}/manual-review': {
    post: {
      tags: ['Verification'],
      summary: 'Record a manual review decision (admin)',
      parameters: [{ $ref: '#/components/parameters/ScholarshipId' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['status'],
              properties: {
                status: {
                  type: 'string',
                  enum: ['VERIFIED', 'PARTIALLY_VERIFIED', 'NEEDS_REVIEW', 'REJECTED'],
                },
                notes: { type: 'string', maxLength: 2000 },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Review recorded.',
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },
} as const;

export const recommendationPaths = {
  '/api/recommendations': {
    get: {
      tags: ['Recommendations'],
      summary: 'Personalised recommendations',
      description:
        'Ranked matches for the signed-in user\'s profile. Scores are advisory estimates for discovery and planning, not eligibility decisions.',
      responses: {
        200: {
          description: 'Ranked recommendations, each carrying its scholarship and match assessment.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { type: 'object', additionalProperties: true } },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },
} as const;

export const savedPaths = {
  '/api/saved': {
    get: {
      tags: ['Saved'],
      summary: 'List saved scholarships',
      responses: {
        200: {
          description: 'Saved scholarships, newest first.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/SavedScholarship' } },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    post: {
      tags: ['Saved'],
      summary: 'Save a scholarship',
      description: 'Idempotent — saving an already-saved scholarship returns the existing record.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['scholarshipId'],
              properties: { scholarshipId: { type: 'string', format: 'uuid' } },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Saved.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SavedScholarship' } } },
        },
        400: {
          description: '`scholarshipId` was missing or not a string.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/saved/{scholarshipId}': {
    post: {
      tags: ['Saved'],
      summary: 'Save a scholarship by path id',
      description: 'Path-parameter form of `POST /api/saved`. Equally idempotent.',
      parameters: [
        { name: 'scholarshipId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        201: {
          description: 'Saved.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SavedScholarship' } } },
        },
        400: {
          description: '`scholarshipId` was missing.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    delete: {
      tags: ['Saved'],
      summary: 'Remove a saved scholarship',
      parameters: [
        { name: 'scholarshipId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        200: {
          description: 'Removed.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } },
        },
        400: {
          description: '`scholarshipId` was missing.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: {
          description: 'The scholarship is not in the caller\'s saved list.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },
} as const;
