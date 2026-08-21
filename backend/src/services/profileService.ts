import { prisma } from '../utils/prisma';
import { MatchingService } from './matchingService';
import { safeJsonStringify } from '../utils/jsonHelper';
import { formatStudentProfile } from '../utils/profileSerializer';
import { logger } from '../utils/logger';

export class ProfileService {
  /** Shared with AuthService so both return an identically-shaped profile. */
  private static formatProfile(p: any) {
    return formatStudentProfile(p);
  }

  static async getProfile(userId: string) {
    let profile = await prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      // Registration creates a profile, but older accounts and n-th-party writes may
      // not have one. Neutral placeholders keep match scoring honest: a real GPA of 0
      // is treated as "not provided" by the matching engine rather than as a value.
      profile = await prisma.studentProfile.create({
        data: {
          userId,
          fullName: 'Student User',
          countryOfResidence: 'Not Specified',
          nationality: 'Not Specified',
          currentDegreeLevel: 'BACHELORS',
          currentDegreeName: 'Undergraduate',
          fieldOfStudy: 'General Studies',
          university: 'Not Specified',
          gpa: 0,
          graduationYear: new Date().getFullYear() + 1,
          targetDegreeLevel: 'MASTERS',
          targetCountries: JSON.stringify([]),
          preferredFields: JSON.stringify([]),
          skills: JSON.stringify([]),
          languageTests: JSON.stringify({}),
        },
      });
    }
    return this.formatProfile(profile)!;
  }

  static async updateProfile(userId: string, data: any) {
    // Only write fields the caller actually supplied.
    //
    // The previous implementation passed safeJsonStringify(data.x, '[]') unconditionally,
    // so a partial update that omitted targetCountries/preferredFields/skills/languageTests
    // silently erased the stored values. maxGpa was worse: omitting it reset the scale to 4.0.
    const updateData: Record<string, any> = {};
    const assignIfPresent = (key: string, value: any) => {
      if (value !== undefined) updateData[key] = value;
    };

    assignIfPresent('fullName', data.fullName);
    assignIfPresent('countryOfResidence', data.countryOfResidence);
    assignIfPresent('nationality', data.nationality);
    assignIfPresent('currentDegreeLevel', data.currentDegreeLevel);
    assignIfPresent('currentDegreeName', data.currentDegreeName);
    assignIfPresent('fieldOfStudy', data.fieldOfStudy);
    assignIfPresent('university', data.university);
    assignIfPresent('gpa', data.gpa);
    assignIfPresent('maxGpa', data.maxGpa);
    assignIfPresent('graduationYear', data.graduationYear);
    assignIfPresent('targetDegreeLevel', data.targetDegreeLevel);
    assignIfPresent('financialPreference', data.financialPreference);
    assignIfPresent('scholarshipPreference', data.scholarshipPreference);
    assignIfPresent('workExperienceYears', data.workExperienceYears);
    assignIfPresent('researchExperience', data.researchExperience);

    if (data.targetCountries !== undefined) updateData.targetCountries = safeJsonStringify(data.targetCountries, '[]');
    if (data.preferredFields !== undefined) updateData.preferredFields = safeJsonStringify(data.preferredFields, '[]');
    if (data.skills !== undefined) updateData.skills = safeJsonStringify(data.skills, '[]');
    if (data.languageTests !== undefined) updateData.languageTests = safeJsonStringify(data.languageTests, '{}');

    const updatedProfile = await prisma.studentProfile.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        fullName: data.fullName ?? 'Student User',
        countryOfResidence: data.countryOfResidence ?? 'Not Specified',
        nationality: data.nationality ?? 'Not Specified',
        currentDegreeLevel: data.currentDegreeLevel ?? 'BACHELORS',
        currentDegreeName: data.currentDegreeName ?? 'Undergraduate',
        fieldOfStudy: data.fieldOfStudy ?? 'General Studies',
        university: data.university ?? 'Not Specified',
        gpa: data.gpa ?? 0,
        maxGpa: data.maxGpa ?? 4.0,
        graduationYear: data.graduationYear ?? new Date().getFullYear() + 1,
        targetDegreeLevel: data.targetDegreeLevel ?? 'MASTERS',
        targetCountries: safeJsonStringify(data.targetCountries, '[]'),
        preferredFields: safeJsonStringify(data.preferredFields, '[]'),
        languageTests: safeJsonStringify(data.languageTests, '{}'),
        financialPreference: data.financialPreference,
        scholarshipPreference: data.scholarshipPreference,
        skills: safeJsonStringify(data.skills, '[]'),
        workExperienceYears: data.workExperienceYears ?? 0,
        researchExperience: data.researchExperience,
      },
    });

    // Match recalculation is intentionally fire-and-forget: the profile save must not
    // block on a full catalogue sweep. Failures are logged, and the next call to
    // getRecommendationsForUser recalculates anyway via the profile-hash check.
    MatchingService.recalculateMatchesForProfile(updatedProfile.id).catch((err) =>
      logger.error('Background match recalculation failed', { profileId: updatedProfile.id, message: err?.message })
    );

    return this.formatProfile(updatedProfile)!;
  }
}
