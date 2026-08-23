/**
 * Reusable OpenAPI components for the ScholarAI API.
 *
 * Every schema here mirrors a shape the API actually returns or accepts — the
 * serialisers in `services/`, the Zod schemas in `validators/` and the error
 * envelope in `middleware/errorHandler.ts`. Nothing speculative is documented.
 */

/** JWT bearer auth, as enforced by `middleware/auth.ts`. */
export const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: [
      'JWT issued by `POST /api/auth/register` or `POST /api/auth/login`.',
      '',
      'Send it as `Authorization: Bearer <token>`. Tokens expire after `JWT_EXPIRES_IN`',
      '(7 days by default); an expired token returns 401 with `code: "TOKEN_EXPIRED"`.',
    ].join('\n'),
  },
} as const;

const DEGREE_LEVELS = ['HIGH_SCHOOL', 'BACHELORS', 'MASTERS', 'PHD', 'POSTDOC', 'SHORT_COURSE'];
const FUNDING_TYPES = ['FULL_FUNDING', 'PARTIAL_FUNDING', 'TUITION_ONLY', 'STIPEND_ONLY', 'TRAVEL_GRANT'];
const VERIFICATION_STATUSES = [
  'VERIFIED',
  'PARTIALLY_VERIFIED',
  'UNVERIFIED',
  'NEEDS_REVIEW',
  'REJECTED',
  'PENDING_VERIFICATION',
  'EXPIRED',
];
const APPLICATION_STATUSES = [
  'INTERESTED',
  'PREPARING',
  'READY_TO_APPLY',
  'APPLIED',
  'INTERVIEW',
  'ACCEPTED',
  'REJECTED',
];
const ELIGIBILITY_STATUSES = ['ELIGIBLE', 'POTENTIALLY_ELIGIBLE', 'NOT_ELIGIBLE', 'INSUFFICIENT_INFORMATION'];

export const schemas = {
  // ---------------------------------------------------------------- errors --
  Error: {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'Record not found.' },
      stack: {
        type: 'string',
        description: 'Present only when `NODE_ENV` is not `production`.',
      },
    },
    required: ['error'],
  },

  ValidationError: {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'Validation Error' },
      details: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', example: 'body.password' },
            message: { type: 'string', example: 'Password must be at least 10 characters long' },
          },
        },
      },
    },
    required: ['error'],
  },

  AuthError: {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'Access token has expired' },
      code: {
        type: 'string',
        enum: ['TOKEN_EXPIRED', 'TOKEN_INVALID'],
        description: 'Present when an supplied token was rejected, absent when none was sent.',
      },
    },
    required: ['error'],
  },

  // ------------------------------------------------------------ auth/users --
  StudentProfile: {
    type: 'object',
    description:
      'Academic profile backing matching and eligibility. JSON-backed columns are parsed into real arrays/objects before they leave the API.',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      fullName: { type: 'string', example: 'Amina Rahman' },
      countryOfResidence: { type: 'string', example: 'Pakistan' },
      nationality: { type: 'string', example: 'Pakistani' },
      currentDegreeLevel: { type: 'string', enum: DEGREE_LEVELS },
      currentDegreeName: { type: 'string', example: 'BSc Computer Science' },
      fieldOfStudy: { type: 'string', example: 'Computer Science' },
      university: { type: 'string', example: 'NUST' },
      gpa: { type: 'number', format: 'float', example: 3.7 },
      maxGpa: { type: 'number', format: 'float', example: 4 },
      graduationYear: { type: 'integer', example: 2026 },
      targetDegreeLevel: { type: 'string', enum: DEGREE_LEVELS },
      targetCountries: { type: 'array', items: { type: 'string' }, example: ['Germany', 'Canada'] },
      preferredFields: { type: 'array', items: { type: 'string' }, example: ['Machine Learning'] },
      languageTests: {
        type: 'object',
        additionalProperties: { oneOf: [{ type: 'number' }, { type: 'string' }] },
        example: { IELTS: 7.5, TOEFL: 105 },
      },
      financialPreference: { type: 'string', nullable: true },
      scholarshipPreference: { type: 'string', nullable: true },
      skills: { type: 'array', items: { type: 'string' }, example: ['Python', 'PyTorch'] },
      workExperienceYears: { type: 'number', example: 2 },
      researchExperience: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  ProfileUpdateRequest: {
    type: 'object',
    description: 'Partial update — send only the fields you want to change. Unknown keys are stripped.',
    properties: {
      fullName: { type: 'string', maxLength: 120 },
      countryOfResidence: { type: 'string', maxLength: 120 },
      nationality: { type: 'string', maxLength: 120 },
      currentDegreeLevel: { type: 'string', enum: DEGREE_LEVELS },
      currentDegreeName: { type: 'string', maxLength: 120 },
      fieldOfStudy: { type: 'string', maxLength: 120 },
      university: { type: 'string', maxLength: 200 },
      gpa: { type: 'number', minimum: 0, maximum: 100 },
      maxGpa: { type: 'number', minimum: 1, maximum: 100 },
      graduationYear: { type: 'integer', minimum: 1950, maximum: 2100 },
      targetDegreeLevel: { type: 'string', enum: DEGREE_LEVELS },
      targetCountries: { type: 'array', maxItems: 25, items: { type: 'string' } },
      preferredFields: { type: 'array', maxItems: 25, items: { type: 'string' } },
      languageTests: {
        type: 'object',
        additionalProperties: { oneOf: [{ type: 'number' }, { type: 'string' }] },
      },
      financialPreference: { type: 'string', maxLength: 120 },
      scholarshipPreference: { type: 'string', maxLength: 120 },
      skills: { type: 'array', maxItems: 100, items: { type: 'string', maxLength: 64 } },
      workExperienceYears: { type: 'number', minimum: 0, maximum: 70 },
      researchExperience: { type: 'string', maxLength: 4000 },
    },
  },

  AuthUser: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['STUDENT', 'ADMIN'] },
      profile: { allOf: [{ $ref: '#/components/schemas/StudentProfile' }], nullable: true },
    },
  },

  AuthResponse: {
    type: 'object',
    properties: {
      user: { $ref: '#/components/schemas/AuthUser' },
      token: {
        type: 'string',
        description: 'JWT bearer token. Store it and send it as `Authorization: Bearer <token>`.',
      },
    },
  },

  RegisterRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 254, example: 'student@example.com' },
      password: {
        type: 'string',
        minLength: 10,
        maxLength: 128,
        description: 'At least 10 characters, including a lowercase letter, an uppercase letter and a number.',
        example: 'CorrectHorse7',
      },
      fullName: { type: 'string', maxLength: 120, example: 'Amina Rahman' },
    },
  },

  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'student@example.com' },
      password: { type: 'string', maxLength: 128, example: 'CorrectHorse7' },
    },
  },

  CurrentUser: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['STUDENT', 'ADMIN'] },
      isAdmin: {
        type: 'boolean',
        description:
          'Whether this account may reach admin-only routes. Computed server-side from the role **or** membership of ADMIN_EMAILS — read this rather than comparing `role`, which does not reflect an ADMIN_EMAILS grant.',
      },
      isVerified: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      profile: { allOf: [{ $ref: '#/components/schemas/StudentProfile' }], nullable: true },
    },
  },

  // ---------------------------------------------------------- scholarships --
  Scholarship: {
    type: 'object',
    description:
      'Catalogue entry. Several fields are exposed under two names (`country`/`hostCountry`, `fields`/`fieldsOfStudy`, `stipend`/`stipendAmount`) for client compatibility.',
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string', example: 'DAAD EPOS Scholarship' },
      provider: { type: 'string', example: 'DAAD' },
      university: { type: 'string' },
      organization: { type: 'string' },
      country: { type: 'string', example: 'Germany' },
      hostCountry: { type: 'string', example: 'Germany' },
      degreeLevels: { type: 'array', items: { type: 'string', enum: DEGREE_LEVELS } },
      fieldsOfStudy: { type: 'array', items: { type: 'string' } },
      fields: { type: 'array', items: { type: 'string' } },
      fundingType: { type: 'string', enum: FUNDING_TYPES },
      tuitionCoverage: { type: 'string' },
      stipend: { type: 'string', nullable: true },
      stipendAmount: { type: 'string', nullable: true },
      accommodation: { type: 'boolean' },
      accommodationCoverage: { type: 'boolean' },
      accommodationDetails: { type: 'string', nullable: true },
      travelAllowance: { type: 'boolean' },
      minGpa: { type: 'number', nullable: true },
      maxGpaScale: { type: 'number', example: 4 },
      gpaRequirements: { type: 'string', nullable: true },
      eligibleNationalities: { type: 'array', items: { type: 'string' } },
      nationalityRequirements: { type: 'string', nullable: true },
      languageRequirements: {
        type: 'object',
        additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        example: { IELTS: 6.5 },
      },
      eligibilityDescription: { type: 'string', nullable: true },
      requiredDocuments: { type: 'array', items: { type: 'string' } },
      applicationProcess: { type: 'string' },
      deadline: { type: 'string', format: 'date-time', nullable: true },
      officialUrl: { type: 'string', format: 'uri' },
      officialApplicationUrl: { type: 'string', format: 'uri' },
      sourceUrl: { type: 'string', format: 'uri', nullable: true },
      verificationStatus: { type: 'string', enum: VERIFICATION_STATUSES },
      verificationConfidence: { type: 'number', format: 'float', example: 0.92 },
      verificationReport: { type: 'object', nullable: true, additionalProperties: true },
      lastVerifiedAt: { type: 'string', format: 'date-time', nullable: true },
      lastVerifiedDate: { type: 'string', format: 'date-time', nullable: true },
      isDemo: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      verifications: { type: 'array', items: { type: 'object', additionalProperties: true } },
      sources: { type: 'array', items: { type: 'object', additionalProperties: true } },
      userMatch: {
        allOf: [{ $ref: '#/components/schemas/MatchEvaluation' }],
        nullable: true,
        description: 'Present only for an authenticated caller with a cached match for this scholarship.',
      },
      isSaved: { type: 'boolean' },
      applicationStatus: { type: 'string', enum: APPLICATION_STATUSES, nullable: true },
    },
  },

  ScholarshipWriteRequest: {
    type: 'object',
    required: [
      'title',
      'provider',
      'hostCountry',
      'degreeLevels',
      'fieldsOfStudy',
      'applicationProcess',
      'officialUrl',
    ],
    properties: {
      title: { type: 'string', minLength: 3, maxLength: 300 },
      provider: { type: 'string', minLength: 2, maxLength: 200 },
      university: { type: 'string', maxLength: 200 },
      organization: { type: 'string', maxLength: 200 },
      hostCountry: { type: 'string', minLength: 2, maxLength: 100 },
      degreeLevels: {
        type: 'array',
        minItems: 1,
        maxItems: 10,
        items: { type: 'string', enum: DEGREE_LEVELS },
      },
      fieldsOfStudy: { type: 'array', minItems: 1, maxItems: 40, items: { type: 'string', maxLength: 120 } },
      fundingType: { type: 'string', enum: FUNDING_TYPES, default: 'FULL_FUNDING' },
      tuitionCoverage: { type: 'string', maxLength: 300 },
      stipendAmount: { type: 'string', maxLength: 200 },
      travelAllowance: { type: 'boolean', default: false },
      accommodationCoverage: { type: 'boolean', default: false },
      accommodationDetails: { type: 'string', maxLength: 1000 },
      minGpa: { type: 'number', minimum: 0, maximum: 100 },
      maxGpaScale: { type: 'number', minimum: 1, maximum: 100, default: 4 },
      gpaRequirements: { type: 'string', maxLength: 500 },
      eligibleNationalities: { type: 'array', maxItems: 250, items: { type: 'string', maxLength: 100 } },
      nationalityRequirements: { type: 'string', maxLength: 1000 },
      languageRequirements: {
        type: 'object',
        additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }] },
      },
      eligibilityDescription: { type: 'string', maxLength: 4000 },
      requiredDocuments: { type: 'array', maxItems: 40, items: { type: 'string', maxLength: 200 } },
      applicationProcess: { type: 'string', minLength: 10, maxLength: 4000 },
      deadline: {
        type: 'string',
        nullable: true,
        description: 'ISO 8601 date (`2026-03-31`) or date-time with offset.',
      },
      officialUrl: { type: 'string', format: 'uri', description: 'Must use http or https.' },
      sourceUrl: { type: 'string', format: 'uri', nullable: true },
      verificationStatus: { type: 'string', enum: VERIFICATION_STATUSES, default: 'VERIFIED' },
      isDemo: { type: 'boolean', default: true },
    },
  },

  ScholarshipFilterFacets: {
    type: 'object',
    description: 'Facet values for the search UI. Cached server-side for five minutes.',
    properties: {
      countries: { type: 'array', items: { type: 'string' } },
      fundingTypes: { type: 'array', items: { type: 'string' } },
      degreeLevels: { type: 'array', items: { type: 'string' } },
      fieldsOfStudy: { type: 'array', items: { type: 'string' } },
      verificationStatuses: { type: 'array', items: { type: 'string' } },
    },
  },

  ScholarshipSearchResult: {
    type: 'object',
    properties: {
      total: { type: 'integer', example: 142 },
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 12 },
      totalPages: { type: 'integer', example: 12 },
      items: { type: 'array', items: { $ref: '#/components/schemas/Scholarship' } },
      availableFilters: { $ref: '#/components/schemas/ScholarshipFilterFacets' },
      notice: {
        type: 'string',
        description: 'Set only when match sorting had to be windowed to the most recent matches.',
      },
    },
  },

  // ------------------------------------------------- matching / eligibility --
  MatchBreakdown: {
    type: 'object',
    properties: {
      degreeMatch: { type: 'boolean' },
      fieldMatch: { type: 'boolean' },
      countryMatch: { type: 'boolean' },
      gpaMatch: {
        oneOf: [{ type: 'boolean' }, { type: 'string', enum: ['NOT_REQUIRED', 'UNCERTAIN'] }],
      },
      nationalityMatch: {
        oneOf: [{ type: 'boolean' }, { type: 'string', enum: ['ALL_ELIGIBLE', 'UNCERTAIN'] }],
      },
      languageMatch: {
        oneOf: [{ type: 'boolean' }, { type: 'string', enum: ['NOT_SPECIFIED', 'UNCERTAIN'] }],
      },
      documentCount: { type: 'integer' },
    },
  },

  MatchEvaluation: {
    type: 'object',
    description:
      'Advisory compatibility estimate. Legacy aliases (`matchPercentage`, `eligibility`, `matchReasons`, `missingReqs`, `concerns`, `nextSteps`) mirror the canonical fields.',
    properties: {
      matchScore: { type: 'number', format: 'float', minimum: 0, maximum: 100, example: 84 },
      eligibilityStatus: { type: 'string', enum: ELIGIBILITY_STATUSES },
      matchingCriteria: { type: 'array', items: { type: 'string' } },
      missingCriteria: {
        type: 'array',
        items: { type: 'string' },
        description: 'Hard blockers that genuinely disqualify the applicant.',
      },
      uncertainCriteria: {
        type: 'array',
        items: { type: 'string' },
        description: 'Soft mismatches — these map to POTENTIALLY_ELIGIBLE rather than NOT_ELIGIBLE.',
      },
      warnings: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } },
      breakdown: { $ref: '#/components/schemas/MatchBreakdown' },
      disclaimer: { type: 'string' },
      isCached: { type: 'boolean' },
      calculatedAt: { type: 'string', format: 'date-time' },
      matchPercentage: { type: 'number', format: 'float' },
      eligibility: { type: 'string', enum: ELIGIBILITY_STATUSES },
      matchReasons: { type: 'array', items: { type: 'string' } },
      missingReqs: { type: 'array', items: { type: 'string' } },
      concerns: { type: 'array', items: { type: 'string' } },
      nextSteps: { type: 'array', items: { type: 'string' } },
    },
  },

  CustomEligibilityRequest: {
    type: 'object',
    description: 'Ad-hoc "what if my profile were…" check. Only the listed keys are accepted.',
    properties: {
      profile: {
        type: 'object',
        properties: {
          targetDegreeLevel: { type: 'string', enum: DEGREE_LEVELS },
          fieldOfStudy: { type: 'string', maxLength: 120 },
          preferredFields: { type: 'array', maxItems: 25, items: { type: 'string' } },
          targetCountries: { type: 'array', maxItems: 25, items: { type: 'string' } },
          gpa: { type: 'number', minimum: 0, maximum: 100 },
          maxGpa: { type: 'number', minimum: 1, maximum: 100 },
          nationality: { type: 'string', maxLength: 100 },
          countryOfResidence: { type: 'string', maxLength: 100 },
          languageTests: {
            type: 'object',
            additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }] },
          },
          workExperienceYears: { type: 'number', minimum: 0, maximum: 70 },
        },
      },
    },
  },

  RecalculateMatchesResponse: {
    type: 'object',
    properties: {
      message: { type: 'string', example: 'Matches recalculated successfully' },
      count: { type: 'integer', example: 24 },
      recommendations: { type: 'array', items: { type: 'object', additionalProperties: true } },
    },
  },

  // ------------------------------------------------------------ engagement --
  SavedScholarship: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      scholarshipId: { type: 'string', format: 'uuid' },
      createdAt: { type: 'string', format: 'date-time' },
      scholarship: { $ref: '#/components/schemas/Scholarship' },
    },
  },

  Deadline: {
    type: 'object',
    properties: {
      scholarship: { $ref: '#/components/schemas/Scholarship' },
      status: {
        type: 'string',
        description: 'Application status, or `SAVED` when the scholarship is only bookmarked.',
        example: 'PREPARING',
      },
      isSaved: { type: 'boolean' },
      daysRemaining: { type: 'integer', example: 12 },
      urgency: { type: 'string', enum: ['CRITICAL', 'URGENT', 'UPCOMING', 'EXPIRED'] },
      deadlineFormatted: { type: 'string', example: 'Mar 31, 2026' },
    },
  },

  DeadlineAutomationResult: {
    type: 'object',
    properties: {
      timestamp: { type: 'string', format: 'date-time' },
      checkedScholarshipsCount: { type: 'integer' },
      processedUsersCount: { type: 'integer' },
      notificationsCreated: { type: 'integer' },
      duplicatesSuppressed: { type: 'integer' },
      submittedSuppressed: { type: 'integer' },
      rejectedSuppressed: { type: 'integer' },
      expiredCount: { type: 'integer' },
      details: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            scholarshipId: { type: 'string', format: 'uuid' },
            scholarshipTitle: { type: 'string' },
            deadline: { type: 'string', format: 'date-time' },
            daysRemaining: { type: 'integer' },
            milestoneTag: { type: 'string' },
            recipientUserId: { type: 'string', format: 'uuid' },
            actionTaken: {
              type: 'string',
              enum: [
                'NOTIFICATION_SENT',
                'SUPPRESSED_ALREADY_SUBMITTED',
                'SUPPRESSED_REJECTED',
                'SUPPRESSED_DUPLICATE',
                'EXPIRED_NOTIFICATION_SENT',
                'NO_ACTIVE_MILESTONE',
              ],
            },
            notes: { type: 'string' },
          },
        },
      },
    },
  },

  Notification: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      message: { type: 'string' },
      type: {
        type: 'string',
        description: 'DEADLINE, NEW_MATCH, UPDATE, APPLICATION_REMINDER.',
        example: 'DEADLINE',
      },
      isRead: { type: 'boolean' },
      link: { type: 'string', nullable: true, example: '/scholarships/8f2c…' },
      dedupeKey: { type: 'string', nullable: true },
      dispatchedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  // ---------------------------------------------------------- applications --
  ChecklistItem: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      applicationId: { type: 'string', format: 'uuid' },
      item: { type: 'string', example: 'Certified degree transcript' },
      isCompleted: { type: 'boolean' },
      dueDate: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  Application: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      scholarshipId: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: APPLICATION_STATUSES },
      notes: { type: 'string', nullable: true },
      submissionDate: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      scholarship: { $ref: '#/components/schemas/Scholarship' },
      checklists: { type: 'array', items: { $ref: '#/components/schemas/ChecklistItem' } },
    },
  },

  ApplicationCreateRequest: {
    type: 'object',
    required: ['scholarshipId'],
    properties: {
      scholarshipId: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: APPLICATION_STATUSES, default: 'INTERESTED' },
      notes: { type: 'string', maxLength: 5000 },
    },
  },

  ApplicationStatusRequest: {
    type: 'object',
    required: ['status'],
    description:
      'Changing the status sends the applicant a ScholarAI "application update" email. Email failures never fail this request.',
    properties: {
      status: { type: 'string', enum: APPLICATION_STATUSES },
      notes: { type: 'string', maxLength: 5000 },
    },
  },

  ApplicationUpdateRequest: {
    type: 'object',
    description: 'At least one field must be supplied.',
    properties: {
      status: { type: 'string', enum: APPLICATION_STATUSES },
      notes: { type: 'string', maxLength: 5000 },
      submissionDate: {
        type: 'string',
        nullable: true,
        description: 'ISO 8601 date or date-time with offset. `null` clears it.',
      },
    },
  },

  ChecklistCreateRequest: {
    type: 'object',
    required: ['item'],
    properties: {
      item: { type: 'string', minLength: 1, maxLength: 300 },
      dueDate: { type: 'string', nullable: true, description: 'ISO 8601 date or date-time with offset.' },
    },
  },

  // ------------------------------------------------------------- documents --
  CVAnalysis: {
    type: 'object',
    description:
      'Nine-dimension CV evaluation. Extraction is anti-hallucination guarded — nothing absent from the document is invented.',
    properties: {
      id: { type: 'string', format: 'uuid' },
      score: { type: 'number', minimum: 0, maximum: 100, example: 76 },
      dimensionScores: {
        type: 'object',
        properties: {
          education: { type: 'number' },
          skills: { type: 'number' },
          projects: { type: 'number' },
          experience: { type: 'number' },
          achievements: { type: 'number' },
          research: { type: 'number' },
          clarity: { type: 'number' },
          scholarshipRelevance: { type: 'number' },
        },
      },
      extractedEntities: {
        type: 'object',
        properties: {
          education: { type: 'array', items: { type: 'string' } },
          skills: { type: 'array', items: { type: 'string' } },
          projects: { type: 'array', items: { type: 'string' } },
          experience: { type: 'array', items: { type: 'string' } },
          achievements: { type: 'array', items: { type: 'string' } },
          research: { type: 'array', items: { type: 'string' } },
        },
      },
      strengths: { type: 'array', items: { type: 'string' } },
      weaknesses: { type: 'array', items: { type: 'string' } },
      missingInformation: { type: 'array', items: { type: 'string' } },
      suggestions: { type: 'array', items: { type: 'string' } },
      scholarshipFitSummary: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  CVSyncRequest: {
    type: 'object',
    required: ['skills'],
    properties: {
      skills: { type: 'array', items: { type: 'string' }, example: ['Python', 'Distributed Systems'] },
      researchSummary: { type: 'string' },
    },
  },

  SOPQuestion: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'q1_hook_motivation' },
      category: { type: 'string', example: '1. Intellectual Hook & Core Motivation' },
      question: { type: 'string' },
      hint: { type: 'string' },
      placeholder: { type: 'string' },
    },
  },

  SOPQuestionSet: {
    type: 'object',
    properties: {
      scholarship: { type: 'string' },
      field: { type: 'string' },
      degree: { type: 'string' },
      questions: { type: 'array', items: { $ref: '#/components/schemas/SOPQuestion' } },
    },
  },

  SOPOutlineRequest: {
    type: 'object',
    properties: {
      targetScholarshipTitle: { type: 'string', example: 'DAAD EPOS' },
      userInputs: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Answers keyed by question id from `GET /api/documents/sop/questions`.',
      },
    },
  },

  SOPOutline: {
    type: 'object',
    properties: {
      targetScholarship: { type: 'string' },
      outline: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            paragraphNumber: { type: 'integer' },
            sectionTitle: { type: 'string' },
            purpose: { type: 'string' },
            recommendedWordCount: { type: 'string', example: '100 - 150 words' },
            userContent: { type: 'string' },
            keyElements: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },

  SOPAnalyzeRequest: {
    type: 'object',
    required: ['draftText'],
    properties: {
      draftText: { type: 'string', minLength: 30, description: 'The statement draft to evaluate.' },
      targetScholarshipTitle: { type: 'string' },
    },
  },

  SOPFeedback: {
    type: 'object',
    properties: {
      alignmentScore: { type: 'number' },
      structureRating: { type: 'string' },
      clarityScore: { type: 'number' },
      relevanceScore: { type: 'number' },
      grammarAndTone: { type: 'string' },
      keyStrengths: { type: 'array', items: { type: 'string' } },
      areasForImprovement: { type: 'array', items: { type: 'string' } },
      missingInformation: { type: 'array', items: { type: 'string' } },
      sectionBreakdown: { type: 'array', items: { type: 'object', additionalProperties: true } },
      suggestedOutline: { type: 'array', items: { type: 'object', additionalProperties: true } },
      actionableNextSteps: { type: 'array', items: { type: 'string' } },
    },
  },

  SOPSession: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      targetScholarship: { type: 'string' },
      draftText: { type: 'string' },
      feedback: { $ref: '#/components/schemas/SOPFeedback' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  SOPRefineRequest: {
    type: 'object',
    required: ['originalText'],
    properties: {
      sectionTitle: { type: 'string', default: 'Draft Section' },
      originalText: { type: 'string' },
      instructions: { type: 'string', example: 'Make the research motivation more concrete.' },
    },
  },

  SOPRefineResponse: {
    type: 'object',
    properties: {
      sectionTitle: { type: 'string' },
      originalText: { type: 'string' },
      refinedText: { type: 'string' },
      changesExplanation: { type: 'string' },
    },
  },

  SOPSaveSessionRequest: {
    type: 'object',
    required: ['draftText'],
    properties: {
      targetScholarship: { type: 'string', default: 'International Scholarship' },
      draftText: { type: 'string' },
      sessionId: {
        type: 'string',
        format: 'uuid',
        description: 'Supply to update an existing session instead of creating a new one.',
      },
    },
  },

  // ------------------------------------------------------------- chatbot --
  ChatMessage: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      conversationId: { type: 'string', format: 'uuid' },
      role: { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
      content: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  ChatConversation: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      title: { type: 'string', example: 'Scholarship Assistant Session' },
      createdAt: { type: 'string', format: 'date-time' },
      messages: { type: 'array', items: { $ref: '#/components/schemas/ChatMessage' } },
    },
  },

  SendMessageRequest: {
    type: 'object',
    required: ['content'],
    properties: {
      content: {
        type: 'string',
        minLength: 1,
        maxLength: 4000,
        example: 'Am I eligible for the DAAD EPOS scholarship?',
      },
    },
  },

  SendMessageResponse: {
    type: 'object',
    properties: {
      conversationId: {
        type: 'string',
        format: 'uuid',
        description: 'The real conversation id — populated when `new` was posted to.',
      },
      message: { type: 'string', description: 'The assistant reply.' },
    },
  },

  // ------------------------------------------------------------ automation --
  WorkflowSummary: {
    type: 'object',
    properties: {
      key: { type: 'string', example: 'deadline-reminder' },
      name: { type: 'string', example: 'Deadline Reminder Engine' },
      description: { type: 'string' },
      intervalMinutes: { type: 'integer' },
      manualOnly: { type: 'boolean' },
      lastRun: { type: 'object', nullable: true, additionalProperties: true },
    },
  },

  WorkflowRun: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      workflowKey: { type: 'string' },
      workflowName: { type: 'string' },
      trigger: { type: 'string', enum: ['SCHEDULED', 'MANUAL'] },
      status: { type: 'string', enum: ['RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED'] },
      attempt: { type: 'integer' },
      startedAt: { type: 'string', format: 'date-time' },
      finishedAt: { type: 'string', format: 'date-time', nullable: true },
      durationMs: { type: 'integer', nullable: true },
      metrics: { type: 'object', nullable: true, additionalProperties: true },
      errorMessage: { type: 'string', nullable: true },
      triggeredBy: { type: 'string', nullable: true },
    },
  },

  AutomationStats: {
    type: 'object',
    properties: {
      schedulerRunning: { type: 'boolean' },
      totalRuns: { type: 'integer' },
      runsLast24h: { type: 'integer' },
      failuresLast24h: { type: 'integer' },
      currentlyRunning: { type: 'integer' },
      registeredWorkflows: { type: 'integer' },
    },
  },

  TriggerWorkflowRequest: {
    type: 'object',
    properties: {
      payload: {
        type: 'object',
        additionalProperties: true,
        description: 'Free-form, workflow-specific input (e.g. `{ "force": true }` for deadline-reminder).',
      },
    },
  },

  // ---------------------------------------------------------------- system --
  HealthStatus: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'online' },
      service: { type: 'string', example: 'AI Scholarship Copilot API' },
      version: { type: 'string', example: '1.0.0' },
      environment: { type: 'string', example: 'development' },
      timestamp: { type: 'string', format: 'date-time' },
    },
  },

  ReadinessStatus: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ready', 'unavailable'] },
      database: { type: 'string', enum: ['connected', 'disconnected'] },
      timestamp: { type: 'string', format: 'date-time' },
    },
  },

  SuccessMessage: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
    },
  },
} as const;

/** Reusable path/query parameters. */
export const parameters = {
  ScholarshipId: {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Scholarship id.',
  },
  ApplicationId: {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Application id.',
  },
  ChecklistId: {
    name: 'checklistId',
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Checklist item id.',
  },
  ConversationId: {
    name: 'conversationId',
    in: 'path',
    required: true,
    schema: { type: 'string', maxLength: 64 },
    description: 'Conversation id. `POST .../messages` also accepts the literal `new`.',
  },
  Page: {
    name: 'page',
    in: 'query',
    schema: { type: 'integer', minimum: 1, default: 1 },
    description: '1-based page number.',
  },
} as const;

/** Reusable responses for the errors every route can produce. */
export const responses = {
  ValidationFailed: {
    description: 'Request failed schema validation.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } },
  },
  Unauthorized: {
    description: 'Missing, malformed or expired bearer token.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthError' } } },
  },
  Forbidden: {
    description: 'Authenticated but not an administrator.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  NotFound: {
    description: 'Resource does not exist or is not owned by the caller.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  Conflict: {
    description: 'Conflicts with existing state.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  RateLimited: {
    description: 'Rate limit exceeded. Check the `Retry-After` header.',
    headers: {
      'Retry-After': { schema: { type: 'integer' }, description: 'Seconds to wait before retrying.' },
      'X-RateLimit-Limit': { schema: { type: 'integer' } },
      'X-RateLimit-Remaining': { schema: { type: 'integer' } },
    },
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  ServerError: {
    description: 'Unexpected server error. The message is deliberately generic; details go to the logs and Sentry.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
} as const;
