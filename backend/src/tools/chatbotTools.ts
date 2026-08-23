import { ScholarshipService } from '../services/scholarshipService';
import { MatchingService } from '../services/matchingService';
import { SavedService } from '../services/savedService';
import { ApplicationService } from '../services/applicationService';
import { DeadlineService } from '../services/deadlineService';
import { ProfileService } from '../services/profileService';
import { prisma } from '../utils/prisma';
import { parseJsonField } from '../utils/jsonHelper';
import { insensitiveContains } from '../utils/prismaFilters';
import { logger } from '../utils/logger';

export const toolDefinitions = [
  // 0. discoverScholarships — EXTERNAL-FIRST live discovery.
  //    Preferred for any find/search/discover request; searchScholarships below only
  //    queries the local knowledge base.
  {
    type: 'function',
    function: {
      name: 'discoverScholarships',
      description:
        'PRIMARY TOOL for finding scholarships. Performs a LIVE EXTERNAL WEB SEARCH of official university sites, government portals and programme pages, extracts and verifies the results, stores them, and returns current opportunities with source URLs. Use this whenever the user asks to find, search for, discover, or look for scholarships — including requests for newly announced or recent opportunities. Do NOT use searchScholarships for fresh discovery.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'The user\'s scholarship request in natural language, e.g. "fully funded Computer Science master\'s scholarships in Europe".',
          },
          recencyDays: {
            type: 'number',
            description: 'Restrict to pages published within N days when the user asks for recent/new scholarships.',
          },
          limit: { type: 'number', description: 'Max results to return (default 8, max 20).' },
        },
        required: ['query'],
      },
    },
  },

  // 1. searchScholarships — local knowledge base only.
  {
    type: 'function',
    function: {
      name: 'searchScholarships',
      description:
        'Searches ONLY the local stored scholarship knowledge base (no live web search). Use for filtering already-known records or when the user explicitly asks about saved/previously seen scholarships. For fresh discovery use discoverScholarships instead.',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Keyword query (e.g. "Computer Science", "DAAD", "Full tuition")' },
          hostCountry: { type: 'string', description: 'Host country (e.g. "Germany", "United Kingdom", "Canada")' },
          degreeLevel: { type: 'string', description: 'Degree level: "BACHELORS", "MASTERS", "PHD", "POSTDOC"' },
          field: { type: 'string', description: 'Field of study / major (e.g. "Computer Science", "Data Science")' },
          fundingType: {
            type: 'string',
            description: 'Funding type: "FULL_FUNDING", "PARTIAL_FUNDING", "TUITION_ONLY"',
          },
          minGpa: { type: 'number', description: 'Maximum allowable minimum GPA threshold' },
          limit: { type: 'number', description: 'Max number of records to return (default 6)' },
        },
      },
    },
  },

  // 2. getScholarshipDetails
  {
    type: 'function',
    function: {
      name: 'getScholarshipDetails',
      description: 'Get comprehensive details of a specific scholarship by its UUID or Title keyword.',
      parameters: {
        type: 'object',
        properties: {
          scholarshipId: { type: 'string', description: 'Unique scholarship UUID' },
          titleKeyword: {
            type: 'string',
            description: 'Title search fallback if UUID is not known (e.g. "DAAD", "Chevening", "Gates Cambridge")',
          },
        },
      },
    },
  },
  // Alias for backward compatibility
  {
    type: 'function',
    function: {
      name: 'getScholarship',
      description: 'Alias for getScholarshipDetails.',
      parameters: {
        type: 'object',
        properties: {
          scholarshipId: { type: 'string', description: 'Unique scholarship UUID' },
          titleKeyword: { type: 'string', description: 'Title search fallback' },
        },
      },
    },
  },

  // 3. getStudentProfile
  {
    type: 'function',
    function: {
      name: 'getStudentProfile',
      description:
        'Retrieve the active authenticated student profile (Degree, GPA, Field of Study, Nationality, Target Countries, Language test scores).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  // 4. checkEligibility
  {
    type: 'function',
    function: {
      name: 'checkEligibility',
      description:
        'Analyze student eligibility for a specific scholarship, returning matchScore (0-100), eligibilityStatus (ELIGIBLE, POTENTIALLY_ELIGIBLE, NOT_ELIGIBLE, INSUFFICIENT_INFORMATION), matchingCriteria, missingCriteria, uncertainCriteria, warnings, and recommendations.',
      parameters: {
        type: 'object',
        properties: {
          scholarshipId: { type: 'string', description: 'Scholarship UUID' },
          titleKeyword: { type: 'string', description: 'Title search keyword if ID is not known' },
        },
      },
    },
  },

  // 5. getRecommendations
  {
    type: 'function',
    function: {
      name: 'getRecommendations',
      description:
        'Get top personalized scholarship recommendations for the student, sorted by match percentage and compatibility.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of recommendations to return (default 5)' },
        },
      },
    },
  },

  // 6. compareScholarships
  {
    type: 'function',
    function: {
      name: 'compareScholarships',
      description:
        'Compare 2 or 3 scholarships side-by-side on funding, stipend, tuition waiver, housing, flight, GPA requirements, eligible nationalities, and deadlines.',
      parameters: {
        type: 'object',
        properties: {
          scholarshipIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of 2 to 4 scholarship UUIDs to compare',
          },
          titleKeywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of title search keywords to resolve and compare',
          },
        },
      },
    },
  },

  // 7. saveScholarship
  {
    type: 'function',
    function: {
      name: 'saveScholarship',
      description: 'Save or bookmark a scholarship to the authenticated user saved list.',
      parameters: {
        type: 'object',
        properties: {
          scholarshipId: { type: 'string', description: 'Scholarship UUID' },
          titleKeyword: { type: 'string', description: 'Title search keyword if UUID is unknown' },
        },
      },
    },
  },

  // 8. removeSavedScholarship
  {
    type: 'function',
    function: {
      name: 'removeSavedScholarship',
      description: 'Remove a scholarship from the authenticated user saved list.',
      parameters: {
        type: 'object',
        properties: {
          scholarshipId: { type: 'string', description: 'Scholarship UUID' },
          titleKeyword: { type: 'string', description: 'Title search keyword if UUID is unknown' },
        },
      },
    },
  },

  // 9. getSavedScholarships
  {
    type: 'function',
    function: {
      name: 'getSavedScholarships',
      description: 'Fetch the list of scholarships bookmarked/saved by the authenticated user.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  // 10. createApplication
  {
    type: 'function',
    function: {
      name: 'createApplication',
      description: 'Add a scholarship to the user Application Tracker / Kanban board.',
      parameters: {
        type: 'object',
        properties: {
          scholarshipId: { type: 'string', description: 'Scholarship UUID' },
          titleKeyword: { type: 'string', description: 'Title search keyword if UUID is unknown' },
          status: {
            type: 'string',
            description: 'Initial status: "INTERESTED", "PREPARING", "READY_TO_APPLY", "APPLIED"',
          },
          notes: { type: 'string', description: 'Optional initial notes for the application' },
        },
      },
    },
  },

  // 11. getApplications
  {
    type: 'function',
    function: {
      name: 'getApplications',
      description:
        'Fetch all tracked scholarship applications for the authenticated user, including checklist progress and status.',
      parameters: {
        type: 'object',
        properties: {
          statusFilter: {
            type: 'string',
            description: 'Optional status filter ("INTERESTED", "PREPARING", "APPLIED", "ACCEPTED")',
          },
        },
      },
    },
  },

  // 12. updateApplicationStatus
  {
    type: 'function',
    function: {
      name: 'updateApplicationStatus',
      description: 'Update the application tracking status or notes for a scholarship.',
      parameters: {
        type: 'object',
        properties: {
          applicationId: { type: 'string', description: 'Application record UUID' },
          scholarshipId: {
            type: 'string',
            description: 'Scholarship UUID (fallback if applicationId is not provided)',
          },
          status: {
            type: 'string',
            description:
              'New status: "INTERESTED", "PREPARING", "READY_TO_APPLY", "APPLIED", "INTERVIEW", "ACCEPTED", "REJECTED"',
          },
          notes: { type: 'string', description: 'Updated notes' },
        },
        required: ['status'],
      },
    },
  },

  // 13. getUpcomingDeadlines
  {
    type: 'function',
    function: {
      name: 'getUpcomingDeadlines',
      description:
        'Fetch upcoming application deadlines for saved and tracked scholarships, categorized by urgency (CRITICAL, URGENT, UPCOMING).',
      parameters: {
        type: 'object',
        properties: {
          daysWindow: { type: 'number', description: 'Optional days window (default 90 days)' },
        },
      },
    },
  },

  // 14. createReminder
  {
    type: 'function',
    function: {
      name: 'createReminder',
      description: 'Set a deadline reminder notification for the authenticated user.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Reminder description or title' },
          dueDate: { type: 'string', description: 'Target cutoff date (ISO format, e.g. "2026-10-15")' },
          daysBefore: { type: 'number', description: 'How many days before cutoff to notify (default 3)' },
        },
        required: ['title', 'dueDate'],
      },
    },
  },

  // 15. updateStudentProfile
  {
    type: 'function',
    function: {
      name: 'updateStudentProfile',
      description:
        'Update academic profile attributes for the authenticated student (e.g. GPA, target degree, field of study, nationality, target countries, language test scores).',
      parameters: {
        type: 'object',
        properties: {
          fullName: { type: 'string', description: 'Student full name' },
          gpa: { type: 'number', description: 'Cumulative GPA' },
          maxGpa: { type: 'number', description: 'GPA scale maximum (e.g. 4.0)' },
          targetDegreeLevel: { type: 'string', description: 'Target degree: "BACHELORS", "MASTERS", "PHD"' },
          fieldOfStudy: { type: 'string', description: 'Primary field of study / major' },
          nationality: { type: 'string', description: 'Citizenship / nationality' },
          countryOfResidence: { type: 'string', description: 'Country of residence' },
          targetCountries: {
            type: 'array',
            items: { type: 'string' },
            description: 'Target countries (e.g. ["Germany", "UK"])',
          },
          preferredFields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Preferred research fields / majors',
          },
          languageTests: { type: 'object', description: 'Language test scores, e.g. {"IELTS": 7.5, "TOEFL": 105}' },
          workExperienceYears: { type: 'number', description: 'Years of work experience' },
        },
      },
    },
  },
  // 16. getCVAnalysis
  {
    type: 'function',
    function: {
      name: 'getCVAnalysis',
      description:
        'Fetch the latest CV analysis report, extracted skills, and format recommendations for the authenticated student.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  // 17. reviewSOPDraft
  {
    type: 'function',
    function: {
      name: 'reviewSOPDraft',
      description:
        'Analyze and provide structural, tone, and alignment feedback on a student Statement of Purpose (SOP) draft for an international scholarship without fabricating achievements.',
      parameters: {
        type: 'object',
        properties: {
          draftText: { type: 'string', description: 'The text of the SOP / Motivation Letter draft' },
          targetScholarshipTitle: { type: 'string', description: 'Target scholarship or university program name' },
        },
        required: ['draftText'],
      },
    },
  },
  // 18. getSOPOutline
  {
    type: 'function',
    function: {
      name: 'getSOPOutline',
      description:
        'Generate a structured 5-paragraph Statement of Purpose outline tailored to the student profile and target scholarship.',
      parameters: {
        type: 'object',
        properties: {
          targetScholarshipTitle: { type: 'string', description: 'Target scholarship or university program name' },
        },
      },
    },
  },
  // 19. getSOPQuestions
  {
    type: 'function',
    function: {
      name: 'getSOPQuestions',
      description:
        'Generate guided discovery and brainstorming questions for writing an authentic Statement of Purpose / Motivation Letter.',
      parameters: {
        type: 'object',
        properties: {
          targetScholarshipTitle: { type: 'string', description: 'Target scholarship or university program name' },
          fieldOfStudy: { type: 'string', description: 'Field of study or academic discipline' },
        },
      },
    },
  },
  // 20. refineSOPSection
  {
    type: 'function',
    function: {
      name: 'refineSOPSection',
      description:
        'Polishes and improves clarity, academic diction, active voice, and flow for a specific draft paragraph without fabricating any facts or achievements.',
      parameters: {
        type: 'object',
        properties: {
          sectionTitle: {
            type: 'string',
            description: 'Section name (e.g., "Introduction & Hook", "Key Research Project")',
          },
          originalText: { type: 'string', description: 'The exact draft text to refine' },
          instructions: { type: 'string', description: 'Optional specific editing guidelines' },
        },
        required: ['originalText'],
      },
    },
  },
];

/**
 * Resolves a scholarship ID from a UUID or a title keyword.
 * A blank/whitespace keyword must not match — `contains: ''` matches every row,
 * which would silently resolve to an arbitrary scholarship.
 */
async function resolveScholarshipId(scholarshipId?: string, titleKeyword?: string): Promise<string | null> {
  if (scholarshipId && typeof scholarshipId === 'string' && scholarshipId.trim()) {
    const existing = await prisma.scholarship.findUnique({
      where: { id: scholarshipId.trim() },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  const cleanKeyword = String(titleKeyword || '').trim();
  if (cleanKeyword.length >= 2) {
    const match = await prisma.scholarship.findFirst({
      where: {
        OR: [
          { title: insensitiveContains(cleanKeyword) },
          { provider: insensitiveContains(cleanKeyword) },
          { university: insensitiveContains(cleanKeyword) },
        ],
      },
      select: { id: true },
    });
    if (match) return match.id;
  }

  return null;
}

/**
 * Centralised tool execution engine.
 *
 * Every tool receives `userId` from the authenticated session — never from the model —
 * so a tool call can only read or mutate the calling user's own records. Errors are
 * returned as `{ error }` rather than thrown, so a single failed tool degrades the
 * answer instead of failing the whole chat turn.
 */
export async function executeToolCall(toolName: string, args: any, userId: string): Promise<any> {
  if (!userId) {
    // Defensive: an unscoped tool call must never reach the database layer.
    return { error: 'Tool execution requires an authenticated user context.' };
  }

  const safeArgs: any = args && typeof args === 'object' ? args : {};

  try {
    switch (toolName) {
      // 0. discoverScholarships — live external discovery pipeline.
      case 'discoverScholarships':
      case 'searchLiveScholarships': {
        const { ScholarshipDiscoveryService } = await import('../services/discovery/scholarshipDiscoveryService');
        const query = String(safeArgs.query || safeArgs.q || '').trim();
        if (!query) return { error: 'A search query is required to discover scholarships.' };

        const discovery = await ScholarshipDiscoveryService.discover(query, userId, {
          limit: safeArgs.limit ? Math.min(20, Math.max(1, Number(safeArgs.limit))) : 8,
          recencyDays: safeArgs.recencyDays ? Number(safeArgs.recencyDays) : undefined,
        });

        return {
          // Explicit provenance so the assistant can be honest about where results came from.
          usedLiveExternalSearch: discovery.usedExternalSearch,
          searchProvider: discovery.searchProvider,
          externalQueriesIssued: discovery.queriesIssued,
          externalPagesRetrieved: discovery.externalHits,
          sourcePagesRead: discovery.pagesRetrieved,
          sourcePagesSkippedByRobots: discovery.pagesBlockedByRobots,
          newlyDiscovered: discovery.created,
          updatedExisting: discovery.updated,
          rejectedUnverifiable: discovery.rejected,
          notices: discovery.notices,
          count: discovery.items.length,
          items: discovery.items.map((i) => ({
            title: i.title,
            provider: i.provider,
            university: i.university,
            hostCountry: i.hostCountry,
            degreeLevels: i.degreeLevels,
            fieldsOfStudy: i.fieldsOfStudy,
            fundingType: i.fundingType,
            tuitionCoverage: i.tuitionCoverage,
            stipendAmount: i.stipendAmount,
            deadline: i.deadline,
            officialUrl: i.officialUrl,
            sourceUrl: i.sourceUrl,
            resultSource: i.source,
            discoveredAt: i.discoveredAt,
            verificationStatus: i.verificationStatus,
            unknownFields: i.unknownFields,
            matchScore: i.matchScore,
            eligibilityStatus: i.eligibilityStatus,
          })),
        };
      }

      // 1. searchScholarships — knowledge base only.
      case 'searchScholarships': {
        const limit = args.limit ? Math.min(20, Math.max(1, Number(args.limit))) : 6;
        const res = await ScholarshipService.searchScholarships({
          q: args.q,
          hostCountry: args.hostCountry || args.country,
          degreeLevel: args.degreeLevel || args.degree,
          field: args.field || args.fieldsOfStudy,
          fundingType: args.fundingType,
          minGpa: args.minGpa,
          limit,
          userId,
        });

        return {
          total: res.total,
          count: res.items.length,
          items: res.items.map((i: any) => ({
            id: i.id,
            title: i.title,
            provider: i.provider,
            university: i.university,
            hostCountry: i.hostCountry,
            fundingType: i.fundingType,
            tuitionCoverage: i.tuitionCoverage,
            stipendAmount: i.stipendAmount,
            deadline: i.deadline,
            // Included so the assistant can link students straight to the provider's
            // official application page instead of describing it.
            officialUrl: i.officialUrl,
            matchScore: i.userMatch?.matchScore ?? i.userMatch?.matchPercentage ?? null,
            eligibilityStatus: i.userMatch?.eligibilityStatus ?? i.userMatch?.eligibility ?? null,
            isSaved: Boolean(i.isSaved),
          })),
        };
      }

      // 2. getScholarshipDetails & getScholarship
      case 'getScholarshipDetails':
      case 'getScholarship': {
        const resolvedId = await resolveScholarshipId(args.scholarshipId, args.titleKeyword);
        if (!resolvedId) {
          return {
            error: `Scholarship not found with provided ID or title: "${args.titleKeyword || args.scholarshipId}"`,
          };
        }

        const scholarship = await ScholarshipService.getScholarshipById(resolvedId, userId);
        if (!scholarship) {
          return { error: `Scholarship details could not be loaded for ID: ${resolvedId}` };
        }

        return {
          id: scholarship.id,
          title: scholarship.title,
          provider: scholarship.provider,
          university: scholarship.university,
          hostCountry: scholarship.hostCountry,
          degreeLevels: scholarship.degreeLevels,
          fieldsOfStudy: scholarship.fieldsOfStudy,
          fundingType: scholarship.fundingType,
          tuitionCoverage: scholarship.tuitionCoverage,
          stipendAmount: scholarship.stipendAmount,
          accommodationCoverage: scholarship.accommodationCoverage,
          travelAllowance: scholarship.travelAllowance,
          minGpa: scholarship.minGpa,
          maxGpaScale: scholarship.maxGpaScale,
          gpaRequirements: scholarship.gpaRequirements,
          eligibleNationalities: scholarship.eligibleNationalities,
          nationalityRequirements: scholarship.nationalityRequirements,
          languageRequirements: scholarship.languageRequirements,
          requiredDocuments: scholarship.requiredDocuments,
          deadline: scholarship.deadline,
          officialUrl: scholarship.officialUrl,
          verificationStatus: scholarship.verificationStatus,
          userMatch: scholarship.userMatch,
          isSaved: scholarship.isSaved,
          applicationStatus: scholarship.applicationStatus,
        };
      }

      // 3. getStudentProfile
      case 'getStudentProfile': {
        const profile = await ProfileService.getProfile(userId);
        return {
          fullName: profile.fullName,
          currentDegreeLevel: profile.currentDegreeLevel,
          fieldOfStudy: profile.fieldOfStudy,
          university: profile.university,
          gpa: profile.gpa,
          maxGpa: profile.maxGpa,
          graduationYear: profile.graduationYear,
          targetDegreeLevel: profile.targetDegreeLevel,
          targetCountries: profile.targetCountries,
          preferredFields: profile.preferredFields,
          nationality: profile.nationality,
          countryOfResidence: profile.countryOfResidence,
          languageTests: profile.languageTests,
          workExperienceYears: profile.workExperienceYears,
        };
      }

      // 4. checkEligibility
      case 'checkEligibility': {
        const resolvedId = await resolveScholarshipId(args.scholarshipId, args.titleKeyword);
        if (!resolvedId) {
          return {
            error: `Scholarship not found to check eligibility for "${args.titleKeyword || args.scholarshipId}"`,
          };
        }

        const scholarship = await prisma.scholarship.findUnique({ where: { id: resolvedId } });
        if (!scholarship) {
          return { error: 'Scholarship record not found in database.' };
        }

        const eligibility = await MatchingService.getScholarshipEligibilityForUser(resolvedId, userId, {
          forceRefresh: true,
        });

        return {
          scholarshipId: resolvedId,
          title: scholarship.title,
          matchScore: eligibility.matchScore,
          eligibilityStatus: eligibility.eligibilityStatus,
          matchingCriteria: eligibility.matchingCriteria,
          missingCriteria: eligibility.missingCriteria,
          uncertainCriteria: eligibility.uncertainCriteria,
          warnings: eligibility.warnings,
          recommendations: eligibility.recommendations,
          breakdown: eligibility.breakdown,
          disclaimer: eligibility.disclaimer,
        };
      }

      // 5. getRecommendations
      case 'getRecommendations': {
        const limit = args.limit ? Math.min(15, Math.max(1, Number(args.limit))) : 5;
        // Push the limit into the query rather than fetching everything and slicing.
        const recs = await MatchingService.getRecommendationsForUser(userId, { limit });

        return recs.map((r: any) => ({
          scholarshipId: r.scholarshipId || r.id,
          title: r.scholarship.title,
          provider: r.scholarship.provider,
          hostCountry: r.scholarship.hostCountry,
          university: r.scholarship.university,
          fundingType: r.scholarship.fundingType,
          deadline: r.scholarship.deadline,
          officialUrl: r.scholarship.officialUrl,
          matchScore: r.matchScore ?? r.matchPercentage,
          eligibilityStatus: r.eligibilityStatus ?? r.eligibility,
          matchingCriteria: r.matchingCriteria?.slice(0, 3) || r.matchReasons?.slice(0, 3) || [],
          recommendations: r.recommendations?.slice(0, 2) || r.nextSteps?.slice(0, 2) || [],
        }));
      }

      // 6. compareScholarships
      case 'compareScholarships': {
        const ids: string[] = Array.isArray(args.scholarshipIds) ? [...new Set(args.scholarshipIds as string[])] : [];

        if (ids.length === 0 && args.titleKeywords && Array.isArray(args.titleKeywords)) {
          for (const kw of args.titleKeywords) {
            const resolved = await resolveScholarshipId(undefined, kw);
            if (resolved && !ids.includes(resolved)) ids.push(resolved);
          }
        }

        // If no or only 1 ID provided, look up saved scholarships or catalog scholarships to compare
        if (ids.length < 2) {
          const saved = await SavedService.getSaved(userId);
          for (const s of saved) {
            if (!ids.includes(s.scholarshipId)) {
              ids.push(s.scholarshipId);
              if (ids.length >= 3) break;
            }
          }
        }

        if (ids.length < 2) {
          // Look up additional verified scholarships from database
          const additional = await prisma.scholarship.findMany({
            where: ids.length > 0 ? { id: { notIn: ids } } : {},
            take: 3 - ids.length,
          });
          for (const a of additional) {
            if (!ids.includes(a.id)) ids.push(a.id);
          }
        }

        if (ids.length === 0) {
          return { error: 'No scholarships found in the database to compare.' };
        }

        const scholarships = await prisma.scholarship.findMany({
          where: { id: { in: ids } },
        });

        if (scholarships.length === 0) {
          return { error: 'Could not find the requested scholarships to compare.' };
        }

        const profile = await prisma.studentProfile.findUnique({ where: { userId } });

        return scholarships.map((s: any) => {
          const evalResult = profile ? MatchingService.evaluateCompatibility(profile, s) : null;
          return {
            id: s.id,
            title: s.title,
            provider: s.provider,
            university: s.university,
            hostCountry: s.hostCountry,
            degreeLevels: parseJsonField(s.degreeLevels, []),
            fieldsOfStudy: parseJsonField(s.fieldsOfStudy, []),
            fundingType: s.fundingType,
            tuitionCoverage: s.tuitionCoverage || '100% Tuition Waiver',
            stipendAmount: s.stipendAmount || 'None',
            accommodationCoverage: s.accommodationCoverage,
            travelAllowance: s.travelAllowance,
            minGpa: s.minGpa ? `${s.minGpa} / ${s.maxGpaScale || 4.0}` : 'Holistic / None',
            eligibleNationalities: parseJsonField(s.eligibleNationalities, []),
            languageRequirements: parseJsonField(s.languageRequirements, {}),
            deadline: s.deadline,
            officialUrl: s.officialUrl,
            matchScore: evalResult?.matchScore ?? null,
            eligibilityStatus: evalResult?.eligibilityStatus ?? null,
          };
        });
      }

      // 7. saveScholarship
      case 'saveScholarship': {
        const resolvedId = await resolveScholarshipId(args.scholarshipId, args.titleKeyword);
        if (!resolvedId) {
          return { error: `Cannot save: Scholarship not found for "${args.titleKeyword || args.scholarshipId}"` };
        }

        const saved = await SavedService.saveScholarship(userId, resolvedId);
        const scholarship = await prisma.scholarship.findUnique({
          where: { id: resolvedId },
          select: { title: true },
        });

        return {
          success: true,
          message: `Successfully saved "${scholarship?.title || 'Scholarship'}" to your bookmarked list.`,
          savedRecordId: saved?.id ?? null,
          scholarshipId: resolvedId,
        };
      }

      // 8. removeSavedScholarship
      case 'removeSavedScholarship': {
        const resolvedId = await resolveScholarshipId(args.scholarshipId, args.titleKeyword);
        if (!resolvedId) {
          return { error: `Cannot remove: Scholarship not found for "${args.titleKeyword || args.scholarshipId}"` };
        }

        await SavedService.removeSavedScholarship(userId, resolvedId);
        const scholarship = await prisma.scholarship.findUnique({ where: { id: resolvedId } });

        return {
          success: true,
          message: `Successfully removed "${scholarship?.title || 'Scholarship'}" from your saved list.`,
          scholarshipId: resolvedId,
        };
      }

      // 9. getSavedScholarships
      case 'getSavedScholarships': {
        const savedList = await SavedService.getSaved(userId);
        return savedList.map((s: any) => ({
          id: s.scholarship.id,
          title: s.scholarship.title,
          provider: s.scholarship.provider,
          hostCountry: s.scholarship.hostCountry,
          fundingType: s.scholarship.fundingType,
          deadline: s.scholarship.deadline,
          tuitionCoverage: s.scholarship.tuitionCoverage,
          stipendAmount: s.scholarship.stipendAmount,
          officialUrl: s.scholarship.officialUrl,
          savedAt: s.createdAt,
        }));
      }

      // 10. createApplication
      case 'createApplication': {
        const resolvedId = await resolveScholarshipId(args.scholarshipId, args.titleKeyword);
        if (!resolvedId) {
          return {
            error: `Cannot track application: Scholarship not found for "${args.titleKeyword || args.scholarshipId}"`,
          };
        }

        const initialStatus = args.status || 'INTERESTED';
        const app = await ApplicationService.createApplication(userId, resolvedId, initialStatus, args.notes);

        if (!app) {
          return { error: 'Could not create or load the application record. Please try again.' };
        }

        const scholarship = await prisma.scholarship.findUnique({
          where: { id: resolvedId },
          select: { title: true },
        });

        return {
          success: true,
          message: `Added "${scholarship?.title || 'Scholarship'}" to your Application Tracker in status "${app.status}".`,
          applicationId: app.id,
          status: app.status,
        };
      }

      // 11. getApplications
      case 'getApplications': {
        const apps = await ApplicationService.getApplications(userId);
        const filtered = args.statusFilter
          ? apps.filter((a: any) => a.status.toLowerCase() === args.statusFilter.toLowerCase())
          : apps;

        return filtered.map((a: any) => ({
          applicationId: a.id,
          scholarshipId: a.scholarshipId,
          scholarshipTitle: a.scholarship.title,
          hostCountry: a.scholarship.hostCountry,
          status: a.status,
          notes: a.notes,
          submissionDate: a.submissionDate,
          checklists: a.checklists,
        }));
      }

      // 12. updateApplicationStatus
      case 'updateApplicationStatus': {
        // Guard the enum here: the model supplies this string, and an unvalidated
        // value would be written straight into the status column and then rendered
        // as an unknown Kanban column in the tracker.
        const VALID_STATUSES = [
          'INTERESTED',
          'PREPARING',
          'READY_TO_APPLY',
          'APPLIED',
          'INTERVIEW',
          'ACCEPTED',
          'REJECTED',
        ];
        const requestedStatus = String(args.status || '').toUpperCase();
        if (!VALID_STATUSES.includes(requestedStatus)) {
          return { error: `Invalid status "${args.status}". Must be one of: ${VALID_STATUSES.join(', ')}.` };
        }

        let targetAppId = args.applicationId;

        if (!targetAppId && args.scholarshipId) {
          const existing = await prisma.application.findUnique({
            where: { userId_scholarshipId: { userId, scholarshipId: args.scholarshipId } },
            select: { id: true },
          });
          if (existing) targetAppId = existing.id;
        }

        // Fall back to the user's single active application when unambiguous.
        if (!targetAppId) {
          const apps = await prisma.application.findMany({
            where: { userId },
            select: { id: true },
            take: 2,
          });
          if (apps.length === 1) targetAppId = apps[0].id;
        }

        if (!targetAppId) {
          return { error: 'Please specify which application to update (by scholarship title or id).' };
        }

        const updated = await ApplicationService.updateStatus(targetAppId, userId, requestedStatus, args.notes);

        return {
          success: true,
          message: `Application status updated to "${requestedStatus}".`,
          applicationId: updated.id,
          status: updated.status,
        };
      }

      // 13. getUpcomingDeadlines
      case 'getUpcomingDeadlines': {
        const deadlines = await DeadlineService.getDeadlines(userId);
        return deadlines.map((d: any) => ({
          scholarshipId: d.scholarship.id,
          title: d.scholarship.title,
          hostCountry: d.scholarship.hostCountry,
          fundingType: d.scholarship.fundingType,
          deadline: d.scholarship.deadline,
          deadlineFormatted: d.deadlineFormatted,
          daysRemaining: d.daysRemaining,
          urgency: d.urgency,
          isSaved: d.isSaved,
          status: d.status,
        }));
      }

      // 14. createReminder
      case 'createReminder': {
        if (!args.title || !args.dueDate) {
          return { error: 'Reminder requires a title and dueDate.' };
        }

        const dueDate = new Date(args.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
          return { error: `Could not parse "${args.dueDate}" as a date. Use YYYY-MM-DD.` };
        }

        const title = String(args.title).trim().slice(0, 200);

        // (userId, title, dueDate) is unique, so a repeated request is idempotent
        // rather than creating a stack of identical reminders.
        const existing = await prisma.reminder.findFirst({ where: { userId, title, dueDate } });
        if (existing) {
          return {
            success: true,
            message: `A reminder for "${title}" on ${dueDate.toLocaleDateString()} already exists.`,
            reminderId: existing.id,
            alreadyExisted: true,
          };
        }

        const reminder = await prisma.reminder.create({
          data: {
            userId,
            title,
            dueDate,
            daysBefore: args.daysBefore !== undefined ? Math.min(365, Math.max(0, Number(args.daysBefore) || 3)) : 3,
          },
        });

        return {
          success: true,
          message: `Deadline reminder "${reminder.title}" set for ${new Date(reminder.dueDate).toLocaleDateString()}.`,
          reminderId: reminder.id,
        };
      }

      // 15. updateStudentProfile
      case 'updateStudentProfile': {
        const updated = await ProfileService.updateProfile(userId, args);
        return {
          success: true,
          message: `Student academic profile updated successfully.`,
          profile: updated,
        };
      }

      // 16. getCVAnalysis / analyzeCV
      case 'getCVAnalysis':
      case 'analyzeCV': {
        const cvService = (await import('../services/cvAnalysisService')).CVAnalysisService;
        // Only treat the argument as CV text when it is substantial. A chat message
        // being misread as a CV produces a meaningless score.
        const suppliedText = typeof args.cvText === 'string' ? args.cvText.trim() : '';
        if (suppliedText.length >= 200) {
          const result = await cvService.analyzeCV(userId, suppliedText.slice(0, 40_000));
          return {
            score: result.score,
            dimensionScores: result.dimensionScores,
            strengths: result.strengths,
            weaknesses: result.weaknesses,
            missingInformation: result.missingInformation,
            suggestions: result.suggestions,
            scholarshipFitSummary: result.scholarshipFitSummary,
          };
        }
        const latest = await cvService.getLatestAnalysis(userId);
        if (!latest) {
          return {
            message: 'No CV analysis found on record. Upload your CV under AI Preparation Tools to generate feedback.',
          };
        }
        return latest;
      }

      // 17. reviewSOPDraft
      case 'reviewSOPDraft': {
        if (!args.draftText) {
          return { error: 'SOP draftText is required.' };
        }
        const sopService = (await import('../services/sopAssistantService')).SOPAssistantService;
        const result = await sopService.analyzeSOP(userId, args.draftText, args.targetScholarshipTitle);
        return {
          targetScholarship: result.targetScholarship,
          alignmentScore: result.feedback?.alignmentScore || 85,
          structureRating: result.feedback?.structureRating || 'Good (4/5)',
          keyStrengths: result.feedback?.keyStrengths || [],
          areasForImprovement: result.feedback?.areasForImprovement || [],
          missingInformation: result.feedback?.missingInformation || [],
          suggestedOutline: result.feedback?.suggestedOutline || [],
        };
      }

      // 18. getSOPOutline
      case 'getSOPOutline': {
        const sopService = (await import('../services/sopAssistantService')).SOPAssistantService;
        const outlineRes = await sopService.generateStructuredOutline(userId, args.targetScholarshipTitle);
        return outlineRes;
      }

      // 19. getSOPQuestions
      case 'getSOPQuestions': {
        const sopService = (await import('../services/sopAssistantService')).SOPAssistantService;
        const questionsRes = await sopService.generateGuidedQuestions(
          userId,
          args.targetScholarshipTitle,
          args.fieldOfStudy
        );
        return questionsRes;
      }

      // 20. refineSOPSection
      case 'refineSOPSection': {
        if (!args.originalText) {
          return { error: 'originalText is required for refinement.' };
        }
        const sopService = (await import('../services/sopAssistantService')).SOPAssistantService;
        const refined = await sopService.refineDraftSection(
          userId,
          args.sectionTitle || 'Draft Paragraph',
          args.originalText,
          args.instructions
        );
        return refined;
      }

      default:
        return { error: `Tool "${toolName}" is not recognized or not implemented.` };
    }
  } catch (err: any) {
    logger.error('Tool execution failed', { tool: toolName, userId, message: err?.message });
    // Surface only a safe message to the model; internals stay in the log.
    return { error: err?.statusCode ? err.message : `Could not complete ${toolName}. Please try again.` };
  }
}
