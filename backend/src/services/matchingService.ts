import { prisma } from '../utils/prisma';
import crypto from 'crypto';
import { parseJsonField, safeJsonStringify } from '../utils/jsonHelper';

export type EligibilityStatus = 'ELIGIBLE' | 'POTENTIALLY_ELIGIBLE' | 'NOT_ELIGIBLE' | 'INSUFFICIENT_INFORMATION';

export interface MatchingBreakdown {
  degreeMatch: boolean;
  fieldMatch: boolean;
  countryMatch: boolean;
  gpaMatch: boolean | 'NOT_REQUIRED' | 'UNCERTAIN';
  nationalityMatch: boolean | 'ALL_ELIGIBLE' | 'UNCERTAIN';
  languageMatch: boolean | 'NOT_SPECIFIED' | 'UNCERTAIN';
  documentCount: number;
}

export interface MatchingEvaluationResult {
  matchScore: number;
  eligibilityStatus: EligibilityStatus;
  matchingCriteria: string[];
  missingCriteria: string[];
  uncertainCriteria: string[];
  warnings: string[];
  recommendations: string[];
  breakdown: MatchingBreakdown;
  disclaimer: string;
  profileHash?: string;
  isCached?: boolean;
  calculatedAt?: string;
  // Backward-compatibility legacy fields
  matchPercentage: number;
  eligibility: EligibilityStatus;
  matchReasons: string[];
  missingReqs: string[];
  concerns: string[];
  nextSteps: string[];
}

export class MatchingService {
  /**
   * Generates a stable hash of the student's relevant profile attributes
   * to determine if cached eligibility results are still fresh.
   */
  public static generateProfileHash(profile: any): string {
    if (!profile) return '';
    const keyData = {
      targetDegreeLevel: profile.targetDegreeLevel || '',
      fieldOfStudy: (profile.fieldOfStudy || '').toLowerCase().trim(),
      preferredFields: parseJsonField(profile.preferredFields, []).map((f: string) => f.toLowerCase().trim()).sort(),
      targetCountries: parseJsonField(profile.targetCountries, []).map((c: string) => c.toLowerCase().trim()).sort(),
      gpa: profile.gpa !== undefined && profile.gpa !== null ? Number(profile.gpa) : null,
      maxGpa: profile.maxGpa !== undefined && profile.maxGpa !== null ? Number(profile.maxGpa) : 4.0,
      nationality: (profile.nationality || '').toLowerCase().trim(),
      countryOfResidence: (profile.countryOfResidence || '').toLowerCase().trim(),
      languageTests: parseJsonField(profile.languageTests, {}),
      workExperienceYears: profile.workExperienceYears || 0,
    };
    return crypto.createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
  }

  /**
   * Pure deterministic evaluation engine.
   * Compares student profile and scholarship requirements, handles all edge cases gracefully,
   * and produces structured results adhering to the official schema.
   */
  public static evaluateCompatibility(profile: any, scholarship: any): MatchingEvaluationResult {
    // 0. Component scoring setup.
    //
    // Each component yields a 0..1 fitness value, combined by WEIGHTS below into a
    // 0-100 score. A flat baseline plus additive bonuses (the previous approach) always
    // saturated the cap, so every scholarship scored ~99 and the number carried no
    // information.
    //
    // `missingCriteria` is reserved for HARD blockers — criteria that genuinely
    // disqualify. Soft mismatches go to `uncertainCriteria`, which maps to
    // POTENTIALLY_ELIGIBLE rather than NOT_ELIGIBLE.
    const components: Record<string, number> = {};
    const matchingCriteria: string[] = [];
    const missingCriteria: string[] = [];
    const uncertainCriteria: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    const disclaimer = 'AI estimate for discovery and planning purposes only. It does NOT constitute guaranteed official eligibility or an admission decision. Official requirements must be verified with the scholarship provider.';
    warnings.push(disclaimer);

    // Parse scholarship criteria
    const degreeLevels: string[] = parseJsonField(scholarship.degreeLevels, []);
    const fieldsOfStudy: string[] = parseJsonField(scholarship.fieldsOfStudy, []);
    const eligibleNationalities: string[] = parseJsonField(scholarship.eligibleNationalities, []);
    const languageRequirements: Record<string, any> = parseJsonField(scholarship.languageRequirements, {});
    const requiredDocuments: string[] = parseJsonField(scholarship.requiredDocuments, []);
    const minGpa = scholarship.minGpa !== null && scholarship.minGpa !== undefined && !isNaN(Number(scholarship.minGpa))
      ? Number(scholarship.minGpa)
      : null;
    const maxGpaScale = scholarship.maxGpaScale ? Number(scholarship.maxGpaScale) : 4.0;

    // Parse student profile attributes
    const studentTargetDegree = (profile?.targetDegreeLevel || '').trim().toUpperCase();
    const studentField = (profile?.fieldOfStudy || '').trim();
    const studentPreferredFields: string[] = parseJsonField(profile?.preferredFields, []);
    const studentTargetCountries: string[] = parseJsonField(profile?.targetCountries, []);
    const studentNationality = (profile?.nationality || '').trim();
    const studentCountryOfResidence = (profile?.countryOfResidence || '').trim();
    const studentGpa = profile?.gpa !== null && profile?.gpa !== undefined && !isNaN(Number(profile?.gpa)) && Number(profile?.gpa) > 0
      ? Number(profile?.gpa)
      : null;
    const studentMaxGpa = profile?.maxGpa ? Number(profile?.maxGpa) : 4.0;
    const studentLanguageTests: Record<string, any> = parseJsonField(profile?.languageTests, {});

    // Check for insufficient student profile information
    const isProfileEmpty = !studentTargetDegree && !studentField && (studentGpa === null);
    if (isProfileEmpty) {
      uncertainCriteria.push('Student profile is incomplete (missing target degree level, field of study, and GPA).');
      recommendations.push('Complete your Academic Profile with your target degree, GPA, and field of study to get accurate eligibility matches.');
      return {
        matchScore: 35,
        eligibilityStatus: 'INSUFFICIENT_INFORMATION',
        matchingCriteria,
        missingCriteria,
        uncertainCriteria,
        warnings,
        recommendations,
        breakdown: {
          degreeMatch: false,
          fieldMatch: false,
          countryMatch: false,
          gpaMatch: 'UNCERTAIN',
          nationalityMatch: 'UNCERTAIN',
          languageMatch: 'UNCERTAIN',
          documentCount: requiredDocuments.length,
        },
        disclaimer,
        matchPercentage: 35,
        eligibility: 'INSUFFICIENT_INFORMATION',
        matchReasons: matchingCriteria,
        missingReqs: missingCriteria,
        concerns: uncertainCriteria,
        nextSteps: recommendations,
      };
    }

    // ----------------------------------------------------
    // 1. DEGREE LEVEL EVALUATION (weight 26)
    // ----------------------------------------------------
    let degreeMatch = false;
    if (degreeLevels.length === 0 || degreeLevels.includes('ALL') || degreeLevels.some((d) => d.toLowerCase().includes('all'))) {
      degreeMatch = true;
      components.degree = 1;
      matchingCriteria.push(`Degree level: open to all degree levels (${studentTargetDegree || 'any'}).`);
    } else if (studentTargetDegree && degreeLevels.includes(studentTargetDegree)) {
      degreeMatch = true;
      components.degree = 1;
      matchingCriteria.push(`Target degree level (${studentTargetDegree}) matches this scholarship.`);
    } else if (!studentTargetDegree) {
      components.degree = 0.5;
      uncertainCriteria.push(`Target degree level is not set in your profile. This scholarship is for: ${degreeLevels.join(', ')}.`);
      recommendations.push(`Set your target degree level to confirm eligibility for ${degreeLevels.join(', ')}.`);
    } else {
      // HARD blocker: a master's award cannot fund a bachelor's applicant.
      components.degree = 0;
      missingCriteria.push(`Degree level mismatch: this scholarship funds ${degreeLevels.join(' or ')}, but your target is ${studentTargetDegree}.`);
    }

    // ----------------------------------------------------
    // 2. FIELD OF STUDY EVALUATION (weight 24)
    // Handles multiple fields of study, wildcard fields, and fuzzy domain alignment
    // ----------------------------------------------------
    let fieldMatch = false;
    const isAllFieldsScholarship = fieldsOfStudy.length === 0 ||
      fieldsOfStudy.some((f) => /all fields|any field|open to all|all majors|general/i.test(f));

    if (isAllFieldsScholarship) {
      fieldMatch = true;
      components.field = 1;
      matchingCriteria.push(`Field of study: open to all majors and academic disciplines.`);
    } else {
      const studentFieldsToTest = [
        studentField,
        ...studentPreferredFields,
      ].filter(Boolean).map((f) => f.toLowerCase());

      const matchedField = fieldsOfStudy.find((sf) => {
        const sfLower = sf.toLowerCase();
        return studentFieldsToTest.some((pf) => {
          return sfLower.includes(pf) || pf.includes(sfLower) || (pf === 'cs' && sfLower.includes('computer')) || (pf.includes('tech') && sfLower.includes('tech'));
        });
      });

      if (matchedField) {
        fieldMatch = true;
        components.field = 1;
        matchingCriteria.push(`Field of study (${studentField || matchedField}) aligns directly with this programme (${matchedField}).`);
      } else if (studentFieldsToTest.length === 0) {
        components.field = 0.5;
        uncertainCriteria.push(`Field of study is not set in your profile. This scholarship focuses on: ${fieldsOfStudy.slice(0, 4).join(', ')}.`);
        recommendations.push(`Add your primary major and preferred research fields to your profile.`);
      } else {
        // SOFT signal, not a blocker. Providers routinely accept adjacent and
        // interdisciplinary backgrounds, so this lowers the score and flags a caveat
        // instead of declaring the student ineligible.
        components.field = 0.2;
        uncertainCriteria.push(`Field focus differs: this scholarship targets [${fieldsOfStudy.slice(0, 4).join(', ')}], while your profile focuses on ${studentField || 'another field'}. Interdisciplinary applicants are often still considered — check the provider's wording.`);
        recommendations.push(`Confirm whether interdisciplinary applications or your minor subjects qualify under ${fieldsOfStudy[0]}.`);
      }
    }

    // ----------------------------------------------------
    // 3. TARGET HOST COUNTRY EVALUATION (weight 8)
    // ----------------------------------------------------
    let countryMatch = false;
    const hostCountry = (scholarship.hostCountry || scholarship.country || '').trim();
    if (hostCountry) {
      const isTargetCountry = studentTargetCountries.some(
        (c) => c.toLowerCase() === hostCountry.toLowerCase() || hostCountry.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(hostCountry.toLowerCase())
      );

      if (isTargetCountry) {
        countryMatch = true;
        components.country = 1;
        matchingCriteria.push(`Host destination (${hostCountry}) is one of your preferred study countries.`);
      } else if (studentTargetCountries.length > 0) {
        // Preference miss, never a blocker.
        components.country = 0.3;
        matchingCriteria.push(`Host country: ${hostCountry} — outside your stated preferences, but still an option.`);
      } else {
        components.country = 0.6;
        matchingCriteria.push(`Host country: ${hostCountry}.`);
      }
    } else {
      components.country = 0.6;
    }

    // ----------------------------------------------------
    // 4. GRADE REQUIREMENT EVALUATION (weight 20)
    // Handles missing GPA, no GPA requirement, and scale conversions
    // ----------------------------------------------------
    let gpaMatch: boolean | 'NOT_REQUIRED' | 'UNCERTAIN' = 'NOT_REQUIRED';
    if (minGpa !== null && minGpa > 0) {
      if (studentGpa !== null) {
        // Normalize student GPA to scholarship scale
        // Scale-normalised, so 85/100 (intermediate percentage marks) and 3.4/4.0
        // compare correctly against a scholarship stated on any scale.
        const normalizedStudentGpa = (studentGpa / studentMaxGpa) * maxGpaScale;
        if (normalizedStudentGpa >= minGpa - 0.05) {
          gpaMatch = true;
          // Graded by headroom above the threshold, so a strong record outscores a
          // borderline pass instead of both landing on the same number.
          const headroom = (normalizedStudentGpa - minGpa) / Math.max(0.01, maxGpaScale - minGpa);
          components.gpa = 0.75 + 0.25 * Math.min(1, Math.max(0, headroom));
          matchingCriteria.push(`Academic performance (${studentGpa}/${studentMaxGpa}) meets the minimum threshold (${minGpa}/${maxGpaScale}).`);
        } else {
          // HARD blocker: an explicitly stated minimum was not met.
          gpaMatch = false;
          components.gpa = 0;
          missingCriteria.push(`Minimum grade not met: this scholarship requires ${minGpa}/${maxGpaScale}, your profile shows ${studentGpa}/${studentMaxGpa}.`);
          recommendations.push(`Strengthen the application with research output, high GRE/GMAT scores, or work experience — some providers weigh these against the grade cutoff.`);
        }
      } else {
        // Missing grade: uncertain, never an automatic rejection.
        gpaMatch = 'UNCERTAIN';
        components.gpa = 0.4;
        uncertainCriteria.push(`No grade recorded in your profile — this scholarship specifies a minimum of ${minGpa}/${maxGpaScale}.`);
        recommendations.push(`Add your GPA or percentage marks (with the correct grading scale) to confirm academic eligibility.`);
      }
    } else {
      gpaMatch = 'NOT_REQUIRED';
      components.gpa = 0.85;
      matchingCriteria.push(`No strict minimum grade specified — holistic assessment of the candidate.`);
    }

    // ----------------------------------------------------
    // 5. NATIONALITY & CITIZENSHIP EVALUATION (weight 10)
    // Handles open-to-all, specific nationality lists, and unknown nationality
    // ----------------------------------------------------
    let nationalityMatch: boolean | 'ALL_ELIGIBLE' | 'UNCERTAIN' = 'ALL_ELIGIBLE';
    const hasSpecificNationalities = eligibleNationalities.length > 0 &&
      !eligibleNationalities.some((n) => /all|international|any|global|worldwide/i.test(n));

    if (!hasSpecificNationalities) {
      nationalityMatch = 'ALL_ELIGIBLE';
      components.nationality = 1;
      matchingCriteria.push(`Nationality: open to international applicants worldwide.`);
    } else {
      const studentNats = [studentNationality, studentCountryOfResidence]
        .filter((n) => n && n !== 'Not Specified' && n !== 'Unknown')
        .map((n) => n.toLowerCase());

      if (studentNats.length === 0) {
        nationalityMatch = 'UNCERTAIN';
        components.nationality = 0.4;
        uncertainCriteria.push(`Nationality is not set in your profile. This scholarship is restricted to citizens of: ${eligibleNationalities.join(', ')}.`);
        recommendations.push(`Add your nationality and country of residence to your profile.`);
      } else {
        const isEligibleNat = eligibleNationalities.some((en) => {
          const enLower = en.toLowerCase();
          return studentNats.some((sn) => enLower.includes(sn) || sn.includes(enLower));
        });

        if (isEligibleNat) {
          nationalityMatch = true;
          components.nationality = 1;
          matchingCriteria.push(`Nationality confirmed eligible (${studentNationality || studentCountryOfResidence} is on the eligible list).`);
        } else {
          // HARD blocker: citizenship restrictions are absolute.
          nationalityMatch = false;
          components.nationality = 0;
          missingCriteria.push(`Nationality restriction: this scholarship is limited to citizens of [${eligibleNationalities.join(', ')}]. Your profile lists ${studentNationality || studentCountryOfResidence}.`);
        }
      }
    }

    // ----------------------------------------------------
    // 6. LANGUAGE PROFICIENCY EVALUATION (weight 12)
    // Handles missing IELTS/TOEFL, test score comparisons, and waivers
    // ----------------------------------------------------
    let languageMatch: boolean | 'NOT_SPECIFIED' | 'UNCERTAIN' = 'NOT_SPECIFIED';
    const hasIeltsReq = languageRequirements.IELTS !== undefined && languageRequirements.IELTS !== null;
    const hasToeflReq = languageRequirements.TOEFL !== undefined && languageRequirements.TOEFL !== null;

    if (hasIeltsReq || hasToeflReq) {
      const studentIelts = studentLanguageTests?.IELTS ? parseFloat(studentLanguageTests.IELTS) : null;
      const studentToefl = studentLanguageTests?.TOEFL ? parseFloat(studentLanguageTests.TOEFL) : null;

      const reqIelts = hasIeltsReq ? parseFloat(languageRequirements.IELTS) : null;
      const reqToefl = hasToeflReq ? parseFloat(languageRequirements.TOEFL) : null;

      if (reqIelts && studentIelts !== null) {
        if (studentIelts >= reqIelts) {
          languageMatch = true;
          components.language = 1;
          matchingCriteria.push(`English proficiency met (IELTS ${studentIelts} vs required ${reqIelts}).`);
        } else {
          // Soft: a retake before the deadline is usually possible, so this reduces the
          // score and raises an action rather than disqualifying outright.
          languageMatch = false;
          components.language = 0.15;
          uncertainCriteria.push(`English score below the stated cutoff: IELTS ${reqIelts} required, your profile records ${studentIelts}. A retake before the deadline would resolve this.`);
          recommendations.push(`Book an IELTS retake targeting at least ${reqIelts} before the application deadline.`);
        }
      } else if (reqToefl && studentToefl !== null) {
        if (studentToefl >= reqToefl) {
          languageMatch = true;
          components.language = 1;
          matchingCriteria.push(`English proficiency met (TOEFL ${studentToefl} vs required ${reqToefl}).`);
        } else {
          languageMatch = false;
          components.language = 0.15;
          uncertainCriteria.push(`English score below the stated cutoff: TOEFL ${reqToefl} required, your profile records ${studentToefl}. A retake before the deadline would resolve this.`);
          recommendations.push(`Retake TOEFL targeting at least ${reqToefl}, or check for an institutional waiver.`);
        }
      } else {
        languageMatch = 'UNCERTAIN';
        components.language = 0.4;
        uncertainCriteria.push(`English requirement unverified — this scholarship specifies ${reqIelts ? `IELTS ${reqIelts}` : ''}${reqIelts && reqToefl ? ' or ' : ''}${reqToefl ? `TOEFL ${reqToefl}` : ''}, but no language scores are recorded in your profile.`);
        recommendations.push(`Check whether your medium of instruction qualifies for an English waiver, or schedule an IELTS/TOEFL test.`);
      }
    } else {
      languageMatch = 'NOT_SPECIFIED';
      components.language = 0.8;
      matchingCriteria.push(`Language requirements: standard institutional guidelines apply.`);
    }

    // ----------------------------------------------------
    // 7. TIME SENSITIVITY & DEADLINE WARNINGS
    // ----------------------------------------------------
    if (scholarship.deadline) {
      const deadlineDate = new Date(scholarship.deadline);
      const now = new Date();
      const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        warnings.push(`The application deadline for this intake passed on ${deadlineDate.toLocaleDateString()}. Confirm if next year's cycle is accepting applications.`);
      } else if (diffDays <= 14) {
        warnings.push(`Urgent deadline: Only ${diffDays} days remaining until the cutoff date (${deadlineDate.toLocaleDateString()}). Submit required documents promptly.`);
      } else if (diffDays <= 45) {
        warnings.push(`Approaching deadline: ${diffDays} days remaining to finalize your application package.`);
      }
    }

    // ----------------------------------------------------
    // 8. ACTIONABLE RECOMMENDATIONS GENERATOR
    // ----------------------------------------------------
    if (requiredDocuments.length > 0) {
      recommendations.push(`Prepare official documents: ${requiredDocuments.slice(0, 4).join(', ')}.`);
    }
    recommendations.push(`Draft a Statement of Purpose (SOP) tailored to ${scholarship.title}.`);
    recommendations.push(`Track this opportunity in your Application Kanban tracker to monitor checklist milestones.`);

    // ----------------------------------------------------
    // 9. FINAL SCORE & ELIGIBILITY STATUS SYNTHESIS
    // Enforces: ELIGIBLE | POTENTIALLY_ELIGIBLE | NOT_ELIGIBLE | INSUFFICIENT_INFORMATION
    // ----------------------------------------------------
    /**
     * Weights sum to 100. Degree and field dominate because they determine whether the
     * award is even the right instrument; country preference is weighted lowest since it
     * reflects taste rather than eligibility.
     */
    const WEIGHTS: Record<string, number> = {
      degree: 26,
      field: 24,
      gpa: 20,
      language: 12,
      nationality: 10,
      country: 8,
    };

    let weightedTotal = 0;
    let weightSum = 0;
    for (const [key, weight] of Object.entries(WEIGHTS)) {
      const value = components[key];
      if (value === undefined) continue;
      weightedTotal += Math.min(1, Math.max(0, value)) * weight;
      weightSum += weight;
    }

    const rawScore = weightSum > 0 ? (weightedTotal / weightSum) * 100 : 40;
    const normalizedScore = Math.max(5, Math.min(99, Math.round(rawScore)));

    /**
     * Verdict.
     *
     * Only HARD blockers in `missingCriteria` produce NOT_ELIGIBLE: a degree-level
     * mismatch, an explicit nationality exclusion, or a stated minimum grade that was
     * not met. Soft mismatches (field divergence, a language retake, an unset field)
     * live in `uncertainCriteria` and yield POTENTIALLY_ELIGIBLE, because providers
     * frequently accept such applicants.
     */
    let eligibilityStatus: EligibilityStatus;

    if (missingCriteria.length > 0) {
      eligibilityStatus = 'NOT_ELIGIBLE';
    } else if (degreeMatch && fieldMatch && uncertainCriteria.length === 0 && normalizedScore >= 80) {
      eligibilityStatus = 'ELIGIBLE';
    } else if (uncertainCriteria.length > 0) {
      eligibilityStatus = 'POTENTIALLY_ELIGIBLE';
    } else if (normalizedScore >= 80) {
      eligibilityStatus = 'ELIGIBLE';
    } else {
      eligibilityStatus = 'POTENTIALLY_ELIGIBLE';
    }

    const breakdown: MatchingBreakdown = {
      degreeMatch,
      fieldMatch,
      countryMatch,
      gpaMatch,
      nationalityMatch,
      languageMatch,
      documentCount: requiredDocuments.length,
    };

    return {
      matchScore: normalizedScore,
      eligibilityStatus,
      matchingCriteria,
      missingCriteria,
      uncertainCriteria,
      warnings,
      recommendations,
      breakdown,
      disclaimer,
      calculatedAt: new Date().toISOString(),
      // Legacy backward compatibility
      matchPercentage: normalizedScore,
      eligibility: eligibilityStatus,
      matchReasons: matchingCriteria,
      missingReqs: missingCriteria,
      concerns: uncertainCriteria,
      nextSteps: recommendations,
    };
  }

  /**
   * Retrieves or computes user-specific match result with caching optimization.
   * If cached match exists with matching profileHash, returns cached result instantly.
   */
  public static async getScholarshipEligibilityForUser(
    scholarshipId: string,
    userId: string,
    options: { forceRefresh?: boolean; useAI?: boolean } = {}
  ): Promise<MatchingEvaluationResult> {
    const [profile, scholarship] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { userId } }),
      prisma.scholarship.findUnique({ where: { id: scholarshipId } }),
    ]);

    if (!scholarship) {
      throw { statusCode: 404, message: 'Scholarship not found' };
    }

    if (!profile) {
      // Return neutral baseline if no profile exists yet
      return this.evaluateCompatibility(null, scholarship);
    }

    const currentProfileHash = this.generateProfileHash(profile);

    // Check existing database cache unless forceRefresh requested
    if (!options.forceRefresh) {
      const cachedMatch = await prisma.scholarshipMatch.findUnique({
        where: {
          profileId_scholarshipId: {
            profileId: profile.id,
            scholarshipId: scholarship.id,
          },
        },
      });

      if (cachedMatch && cachedMatch.profileHash === currentProfileHash) {
        const matchingCriteria = parseJsonField(cachedMatch.matchingCriteria, parseJsonField(cachedMatch.matchReasons, []));
        const missingCriteria = parseJsonField(cachedMatch.missingCriteria, parseJsonField(cachedMatch.missingReqs, []));
        const uncertainCriteria = parseJsonField(cachedMatch.uncertainCriteria, parseJsonField(cachedMatch.concerns, []));
        const recommendations = parseJsonField(cachedMatch.recommendations, parseJsonField(cachedMatch.nextSteps, []));
        const warnings = parseJsonField(cachedMatch.warnings, [
          'AI estimate for discovery and planning purposes only. Official requirements must be verified with the scholarship provider.',
        ]);
        const breakdown: MatchingBreakdown = parseJsonField(cachedMatch.breakdown, {
          degreeMatch: true,
          fieldMatch: true,
          countryMatch: true,
          gpaMatch: 'NOT_REQUIRED' as const,
          nationalityMatch: 'ALL_ELIGIBLE' as const,
          languageMatch: 'NOT_SPECIFIED' as const,
          documentCount: 0,
        });

        const status = (cachedMatch.eligibility as EligibilityStatus) || 'POTENTIALLY_ELIGIBLE';

        return {
          matchScore: Math.round(cachedMatch.matchPercentage),
          eligibilityStatus: status,
          matchingCriteria,
          missingCriteria,
          uncertainCriteria,
          warnings,
          recommendations,
          breakdown,
          disclaimer: 'AI estimate for discovery and planning purposes only. Official requirements must be verified with the scholarship provider.',
          profileHash: cachedMatch.profileHash || currentProfileHash,
          isCached: true,
          calculatedAt: cachedMatch.calculatedAt.toISOString(),
          // Legacy fields
          matchPercentage: Math.round(cachedMatch.matchPercentage),
          eligibility: status,
          matchReasons: matchingCriteria,
          missingReqs: missingCriteria,
          concerns: uncertainCriteria,
          nextSteps: recommendations,
        };
      }
    }

    // Recalculate match
    const evalResult = this.evaluateCompatibility(profile, scholarship);
    evalResult.profileHash = currentProfileHash;
    evalResult.isCached = false;

    // Persist in database cache
    await prisma.scholarshipMatch.upsert({
      where: {
        profileId_scholarshipId: {
          profileId: profile.id,
          scholarshipId: scholarship.id,
        },
      },
      update: {
        matchPercentage: evalResult.matchScore,
        eligibility: evalResult.eligibilityStatus,
        matchingCriteria: safeJsonStringify(evalResult.matchingCriteria),
        missingCriteria: safeJsonStringify(evalResult.missingCriteria),
        uncertainCriteria: safeJsonStringify(evalResult.uncertainCriteria),
        warnings: safeJsonStringify(evalResult.warnings),
        recommendations: safeJsonStringify(evalResult.recommendations),
        breakdown: safeJsonStringify(evalResult.breakdown, '{}'),
        matchReasons: safeJsonStringify(evalResult.matchingCriteria),
        missingReqs: safeJsonStringify(evalResult.missingReqs),
        concerns: safeJsonStringify(evalResult.concerns),
        nextSteps: safeJsonStringify(evalResult.nextSteps),
        profileHash: currentProfileHash,
        calculatedAt: new Date(),
      },
      create: {
        profileId: profile.id,
        scholarshipId: scholarship.id,
        matchPercentage: evalResult.matchScore,
        eligibility: evalResult.eligibilityStatus,
        matchingCriteria: safeJsonStringify(evalResult.matchingCriteria),
        missingCriteria: safeJsonStringify(evalResult.missingCriteria),
        uncertainCriteria: safeJsonStringify(evalResult.uncertainCriteria),
        warnings: safeJsonStringify(evalResult.warnings),
        recommendations: safeJsonStringify(evalResult.recommendations),
        breakdown: safeJsonStringify(evalResult.breakdown, '{}'),
        matchReasons: safeJsonStringify(evalResult.matchingCriteria),
        missingReqs: safeJsonStringify(evalResult.missingReqs),
        concerns: safeJsonStringify(evalResult.concerns),
        nextSteps: safeJsonStringify(evalResult.nextSteps),
        profileHash: currentProfileHash,
      },
    });

    return evalResult;
  }

  /**
   * Recalculates matches for every scholarship against one profile.
   *
   * Writes are chunked into transactions rather than issued one-by-one: on a
   * thousand-record catalogue the previous per-row await produced a thousand
   * sequential round-trips and could take minutes.
   */
  public static async recalculateMatchesForProfile(profileId: string) {
    const profile = await prisma.studentProfile.findUnique({ where: { id: profileId } });
    if (!profile) return 0;

    const scholarships = await prisma.scholarship.findMany();
    const profileHash = this.generateProfileHash(profile);
    const CHUNK_SIZE = 50;

    for (let i = 0; i < scholarships.length; i += CHUNK_SIZE) {
      const chunk = scholarships.slice(i, i + CHUNK_SIZE);

      const operations = chunk.map((scholarship: any) => {
        const evalResult = this.evaluateCompatibility(profile, scholarship);
        const payload = {
          matchPercentage: evalResult.matchScore,
          eligibility: evalResult.eligibilityStatus,
          matchingCriteria: safeJsonStringify(evalResult.matchingCriteria),
          missingCriteria: safeJsonStringify(evalResult.missingCriteria),
          uncertainCriteria: safeJsonStringify(evalResult.uncertainCriteria),
          warnings: safeJsonStringify(evalResult.warnings),
          recommendations: safeJsonStringify(evalResult.recommendations),
          breakdown: safeJsonStringify(evalResult.breakdown, '{}'),
          matchReasons: safeJsonStringify(evalResult.matchingCriteria),
          missingReqs: safeJsonStringify(evalResult.missingReqs),
          concerns: safeJsonStringify(evalResult.concerns),
          nextSteps: safeJsonStringify(evalResult.nextSteps),
          profileHash,
        };

        return prisma.scholarshipMatch.upsert({
          where: {
            profileId_scholarshipId: { profileId: profile.id, scholarshipId: scholarship.id },
          },
          update: { ...payload, calculatedAt: new Date() },
          create: { profileId: profile.id, scholarshipId: scholarship.id, ...payload },
        });
      });

      await prisma.$transaction(operations);
    }

    return scholarships.length;
  }

  /**
   * Top recommendations for a user, highest match first.
   *
   * `limit` is enforced at the database level — returning every match with its full
   * scholarship record embedded produced multi-megabyte responses as the catalogue grew.
   */
  public static async getRecommendationsForUser(userId: string, options: { limit?: number } = {}) {
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return [];

    const currentProfileHash = this.generateProfileHash(profile);

    // Cheap staleness probe: one row is enough to know whether the cache predates
    // the current profile, instead of loading every match to compare hashes.
    const [matchCount, staleSample] = await Promise.all([
      prisma.scholarshipMatch.count({ where: { profileId: profile.id } }),
      prisma.scholarshipMatch.findFirst({
        where: { profileId: profile.id, NOT: { profileHash: currentProfileHash } },
        select: { id: true },
      }),
    ]);

    if (matchCount === 0 || staleSample) {
      await this.recalculateMatchesForProfile(profile.id);
    }

    const matches = await prisma.scholarshipMatch.findMany({
      where: { profileId: profile.id },
      include: { scholarship: true },
      orderBy: [{ matchPercentage: 'desc' }, { calculatedAt: 'desc' }],
      take: limit,
    });

    return matches.map((m: any) => {
      const matchingCriteria = parseJsonField(m.matchingCriteria, parseJsonField(m.matchReasons, []));
      const missingCriteria = parseJsonField(m.missingCriteria, parseJsonField(m.missingReqs, []));
      const uncertainCriteria = parseJsonField(m.uncertainCriteria, parseJsonField(m.concerns, []));
      const recommendations = parseJsonField(m.recommendations, parseJsonField(m.nextSteps, []));
      const warnings = parseJsonField(m.warnings, [
        'AI estimate for discovery and planning purposes only. Official requirements must be verified with the scholarship provider.',
      ]);
      const breakdown: MatchingBreakdown = parseJsonField(m.breakdown, {
        degreeMatch: true,
        fieldMatch: true,
        countryMatch: true,
        gpaMatch: 'NOT_REQUIRED' as const,
        nationalityMatch: 'ALL_ELIGIBLE' as const,
        languageMatch: 'NOT_SPECIFIED' as const,
        documentCount: 0,
      });

      return {
        id: m.id,
        matchScore: Math.round(m.matchPercentage),
        matchPercentage: Math.round(m.matchPercentage),
        eligibilityStatus: m.eligibility as EligibilityStatus,
        eligibility: m.eligibility,
        matchingCriteria,
        missingCriteria,
        uncertainCriteria,
        warnings,
        recommendations,
        breakdown,
        matchReasons: matchingCriteria,
        missingReqs: missingCriteria,
        concerns: uncertainCriteria,
        nextSteps: recommendations,
        calculatedAt: m.calculatedAt,
        scholarship: {
          ...m.scholarship,
          degreeLevels: parseJsonField(m.scholarship.degreeLevels, []),
          fieldsOfStudy: parseJsonField(m.scholarship.fieldsOfStudy, []),
          eligibleNationalities: parseJsonField(m.scholarship.eligibleNationalities, []),
          languageRequirements: parseJsonField(m.scholarship.languageRequirements, {}),
          requiredDocuments: parseJsonField(m.scholarship.requiredDocuments, []),
        },
      };
    });
  }
}
