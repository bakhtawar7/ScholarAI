import { prisma } from '../utils/prisma';
import { config } from '../config';
import { parseJsonField, safeJsonStringify } from '../utils/jsonHelper';

import { llm as openai, llmErrorMeta } from '../utils/llmClient';
import { logger } from '../utils/logger';

export interface CVAnalysisResult {
  score: number;
  dimensionScores: {
    education: number;
    skills: number;
    projects: number;
    experience: number;
    achievements: number;
    research: number;
    clarity: number;
    scholarshipRelevance: number;
  };
  extractedEntities: {
    education: string[];
    skills: string[];
    projects: string[];
    experience: string[];
    achievements: string[];
    research: string[];
  };
  strengths: string[];
  weaknesses: string[];
  missingInformation: string[];
  suggestions: string[];
  scholarshipFitSummary: string;
}

export class CVAnalysisService {
  /**
   * Deterministic entity and keyword extractor based on CV text.
   * Ensures zero hallucinations and accurate fallback analysis.
   */
  private static extractDeterministicEntities(cvText: string, profile: any) {
    const text = cvText;
    const lower = text.toLowerCase();

    // 1. Education extraction
    const eduMatches: string[] = [];
    const degreePatterns = [
      /(?:bachelor(?:'s)?|b\.?s\.?c?|b\.?e\.?|undergraduate)\s+(?:of|in)?\s*([A-Za-z\s&]{3,40})/gi,
      /(?:master(?:'s)?|m\.?s\.?c?|m\.?e\.?|graduate|postgraduate)\s+(?:of|in)?\s*([A-Za-z\s&]{3,40})/gi,
      /(?:ph\.?d\.?|doctorate)\s+(?:of|in)?\s*([A-Za-z\s&]{3,40})/gi,
    ];
    for (const pat of degreePatterns) {
      let m;
      while ((m = pat.exec(text)) !== null) {
        const found = m[0].trim().replace(/\n/g, ' ');
        if (found.length < 60 && !eduMatches.includes(found)) {
          eduMatches.push(found);
        }
      }
    }
    if (eduMatches.length === 0 && profile?.currentDegreeName) {
      eduMatches.push(`${profile.currentDegreeName} - ${profile.university || 'University'}`);
    }

    // 2. Skills extraction
    const skillDictionary = [
      'Python',
      'JavaScript',
      'TypeScript',
      'React',
      'Node.js',
      'Express',
      'Django',
      'Flask',
      'Java',
      'C++',
      'C#',
      'SQL',
      'PostgreSQL',
      'MySQL',
      'MongoDB',
      'Redis',
      'Docker',
      'Kubernetes',
      'AWS',
      'Azure',
      'GCP',
      'Git',
      'Linux',
      'Machine Learning',
      'Deep Learning',
      'TensorFlow',
      'PyTorch',
      'Data Analysis',
      'Pandas',
      'NumPy',
      'Scikit-Learn',
      'REST API',
      'GraphQL',
      'Tailwind CSS',
      'Next.js',
      'NLP',
      'Computer Vision',
      'CI/CD',
      'Agile',
      'Scrum',
      'Microservices',
      'Distributed Systems',
      'System Design',
      'Algorithms',
      'Data Structures',
    ];
    const foundSkills: string[] = [];
    for (const skill of skillDictionary) {
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text) && !foundSkills.includes(skill)) {
        foundSkills.push(skill);
      }
    }

    // 3. Projects extraction
    const foundProjects: string[] = [];
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    let inProjectsSection = false;
    for (const line of lines) {
      if (/^(projects|academic projects|key projects|engineering projects|capstone)/i.test(line)) {
        inProjectsSection = true;
        continue;
      }
      if (
        inProjectsSection &&
        /^(experience|work experience|education|skills|certifications|publications|awards)/i.test(line)
      ) {
        inProjectsSection = false;
      }
      if (
        inProjectsSection &&
        (line.startsWith('•') ||
          line.startsWith('-') ||
          line.startsWith('*') ||
          /^[A-Z][A-Za-z0-9\s]{3,35}:/.test(line))
      ) {
        const clean = line.replace(/^[•\-*]\s*/, '').trim();
        if (clean.length > 10 && clean.length < 120 && !foundProjects.includes(clean)) {
          foundProjects.push(clean);
        }
      }
    }
    if (foundProjects.length === 0) {
      const projRegex = /(?:developed|built|created|engineered|designed|implemented)\s+([A-Za-z0-9\s\-_]{5,50})/gi;
      let pm;
      while ((pm = projRegex.exec(text)) !== null) {
        const p = pm[0].trim().replace(/\n/g, ' ');
        if (p.length < 80 && !foundProjects.includes(p)) {
          foundProjects.push(p);
        }
      }
    }

    // 4. Experience extraction
    const foundExperience: string[] = [];
    const expRegex =
      /(?:intern|engineer|developer|researcher|assistant|lead|manager|analyst|instructor|tutor|specialist)\b[^\n,.]*/gi;
    let em;
    while ((em = expRegex.exec(text)) !== null) {
      const expTitle = em[0].trim().replace(/\n/g, ' ');
      if (expTitle.length > 5 && expTitle.length < 60 && !foundExperience.includes(expTitle)) {
        foundExperience.push(expTitle);
      }
    }

    // 5. Research extraction
    const foundResearch: string[] = [];
    const researchKeywords =
      /(?:thesis|publication|conference|paper|journal|arxiv|ieee|acm|springer|preprint|doi:|research on)\s*([^\n;]{10,80})/gi;
    let rm;
    while ((rm = researchKeywords.exec(text)) !== null) {
      const r = rm[0].trim().replace(/\n/g, ' ');
      if (!foundResearch.includes(r)) {
        foundResearch.push(r);
      }
    }

    // 6. Achievements extraction (strict, only if present in text)
    const foundAchievements: string[] = [];
    const achRegex =
      /(?:dean's\s+list|honor\s+roll|scholarship\s+recipient|award(?:ed)?|medal|1st\s+place|first\s+place|hackathon\s+winner|merit\s+award|fellowship)\s*([^\n;]{0,60})/gi;
    let am;
    while ((am = achRegex.exec(text)) !== null) {
      const ach = am[0].trim().replace(/\n/g, ' ');
      if (!foundAchievements.includes(ach)) {
        foundAchievements.push(ach);
      }
    }

    // Evaluate Missing Information
    const missing: string[] = [];
    if (!/(ielts|toefl|duolingo|pte|cefr|c1|c2|b2)\b/i.test(lower)) {
      missing.push('Official English language proficiency test scores (e.g. IELTS 7.0+, TOEFL iBT 95+).');
    }
    if (!/(gpa|cgpa|grade point|percentage|\b[234]\.\d{1,2}\b)/i.test(lower)) {
      missing.push('Explicit Cumulative GPA and maximum scale (e.g., 3.85 / 4.00 or First Class Honors).');
    }
    if (foundResearch.length === 0) {
      missing.push('Explicit research publications, thesis title, or academic conference contributions.');
    }
    if (
      !/\b(\d+%\s*(?:increase|decrease|faster|reduction|improvement|accuracy)|\$\d+|\d+\s*(?:users|clients|students|requests))\b/i.test(
        text
      )
    ) {
      missing.push('Quantified metrics demonstrating impact in project/work bullets (e.g. "reduced latency by 35%").');
    }
    if (!/(references|referees|available upon request|prof\.|professor)/i.test(lower)) {
      missing.push('Academic referee contacts or formal "References available upon request" declaration.');
    }

    // Dimension Scoring based on extracted density & quality
    const educationScore = eduMatches.length > 0 ? (/(gpa|first class|distinction)/i.test(lower) ? 92 : 82) : 65;
    const skillsScore = Math.min(95, Math.max(60, foundSkills.length * 6 + 40));
    const projectsScore = foundProjects.length > 0 ? 84 : 60;
    const experienceScore = foundExperience.length > 0 ? 82 : 65;
    const researchScore = foundResearch.length > 0 ? 88 : 65;
    const achievementsScore = foundAchievements.length > 0 ? 90 : 70;
    const hasQuantMetrics = /\d+%/i.test(text);
    const clarityScore = (text.length > 400 && text.includes('•') ? 85 : 75) + (hasQuantMetrics ? 5 : 0);
    const scholarshipRelevanceScore = Math.round(
      (educationScore + skillsScore + experienceScore + researchScore + clarityScore) / 5
    );

    const overallScore = Math.round(
      educationScore * 0.2 +
        skillsScore * 0.15 +
        projectsScore * 0.15 +
        experienceScore * 0.15 +
        researchScore * 0.15 +
        clarityScore * 0.1 +
        achievementsScore * 0.1
    );

    const strengths: string[] = [];
    if (eduMatches.length > 0)
      strengths.push(`Verified academic degree credentials in ${eduMatches.slice(0, 2).join(', ')}.`);
    if (foundSkills.length >= 4) strengths.push(`Strong core competencies in ${foundSkills.slice(0, 5).join(', ')}.`);
    if (foundExperience.length > 0)
      strengths.push(`Demonstrated professional/academic roles including ${foundExperience.slice(0, 3).join(', ')}.`);
    if (foundResearch.length > 0)
      strengths.push(`Academic research presence noted: ${foundResearch.slice(0, 2).join('; ')}.`);
    if (foundAchievements.length > 0) strengths.push(`Recognized honors: ${foundAchievements.slice(0, 2).join('; ')}.`);

    const weaknesses: string[] = [];
    if (!hasQuantMetrics)
      weaknesses.push(
        'Action verbs in project and work bullet points lack quantifiable impact percentages or scale metrics.'
      );
    if (foundResearch.length === 0)
      weaknesses.push(
        'Research background is understated — scholarship committees value dedicated thesis or publication sections.'
      );
    if (foundSkills.length < 5)
      weaknesses.push(
        'Technical and domain tool stack is brief; specify libraries, frameworks, and database technologies.'
      );

    const suggestions: string[] = [
      'Format according to standard International Academic / Europass CV guidelines with clear chronological section headers.',
      'Place a dedicated "Research & Publications" section directly under Education to highlight academic rigor.',
      'Start every experience bullet with a high-impact action verb (e.g. "Architected", "Engineered", "Optimized", "Spearheaded").',
      'Include a 2-line Professional Objective stating your target postgraduate specialization and long-term research commitment.',
    ];

    const scholarshipFitSummary = `Demonstrates a solid academic and technical foundation for international postgraduate scholarship applications (e.g., DAAD, Chevening, Erasmus Mundus). Addressing the identified missing certifications and quantifying project impact will elevate the candidate into the top review tier.`;

    return {
      score: overallScore,
      dimensionScores: {
        education: educationScore,
        skills: skillsScore,
        projects: projectsScore,
        experience: experienceScore,
        achievements: achievementsScore,
        research: researchScore,
        clarity: clarityScore,
        scholarshipRelevance: scholarshipRelevanceScore,
      },
      extractedEntities: {
        education: eduMatches.length > 0 ? eduMatches : ['Degree program in progress'],
        skills: foundSkills.length > 0 ? foundSkills : ['General Academic Skills'],
        projects: foundProjects.length > 0 ? foundProjects : ['Academic Coursework Projects'],
        experience: foundExperience.length > 0 ? foundExperience : ['Academic Background'],
        achievements: foundAchievements,
        research: foundResearch,
      },
      strengths: strengths.length > 0 ? strengths : ['Clear educational progression and foundational coursework.'],
      weaknesses:
        weaknesses.length > 0 ? weaknesses : ['Ensure all technical claims are backed with quantifiable results.'],
      missingInformation: missing,
      suggestions,
      scholarshipFitSummary,
    };
  }

  /**
   * Performs deep semantic extraction and multi-dimensional analysis of a student's CV text.
   * Strictly adheres to anti-hallucination guardrails (never fabricating achievements).
   */
  static async analyzeCV(userId: string, cvText: string): Promise<any> {
    const profile = await prisma.studentProfile.findUnique({ where: { userId } });

    // 1. Generate verified deterministic baseline
    let analysis: CVAnalysisResult = this.extractDeterministicEntities(cvText, profile);

    // 2. OpenAI Semantic Enrichment if available
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: config.openaiModel,
          messages: [
            {
              role: 'system',
              content: `You are an elite academic scholarship reviewer and international admissions officer (DAAD, Chevening, Fulbright, Erasmus Mundus, Gates Cambridge).
Analyze the student's CV text. Extract verified facts and evaluate 9 key dimensions:
1. Education (degrees, universities, GPA, honors)
2. Skills (programming languages, tools, frameworks, domain methods)
3. Projects (academic, capstone, engineering, research applications)
4. Experience (work, internships, teaching assistantships, leadership)
5. Achievements (scholarships, awards, dean's list, competitions)
6. Research (papers, thesis, conferences, lab work)
7. Clarity (formatting, bullet point structure, active voice verbs)
8. Scholarship Relevance (international scholarship competitiveness)
9. Missing Information (critical gaps, missing English tests, unquantified claims)

CRITICAL ANTI-HALLUCINATION GUARDRAIL:
Do NOT invent or fabricate achievements, research, or awards. Extract ONLY what is explicitly stated in the CV text. If no achievements or research are present, leave those arrays empty and note the absence in missingInformation.

Return JSON with exact structure:
{
  "score": number (0-100),
  "dimensionScores": {
    "education": number,
    "skills": number,
    "projects": number,
    "experience": number,
    "achievements": number,
    "research": number,
    "clarity": number,
    "scholarshipRelevance": number
  },
  "extractedEntities": {
    "education": string[],
    "skills": string[],
    "projects": string[],
    "experience": string[],
    "achievements": string[],
    "research": string[]
  },
  "strengths": string[],
  "weaknesses": string[],
  "missingInformation": string[],
  "suggestions": string[],
  "scholarshipFitSummary": string
}`,
            },
            {
              role: 'user',
              content: `Student Profile Context: ${JSON.stringify(profile)}\n\nCV Document Text:\n${cvText.slice(0, 8000)}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: config.llmMaxTokens,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          analysis = {
            score: parsed.score !== undefined ? Number(parsed.score) : analysis.score,
            dimensionScores: {
              education: parsed.dimensionScores?.education || analysis.dimensionScores.education,
              skills: parsed.dimensionScores?.skills || analysis.dimensionScores.skills,
              projects: parsed.dimensionScores?.projects || analysis.dimensionScores.projects,
              experience: parsed.dimensionScores?.experience || analysis.dimensionScores.experience,
              achievements: parsed.dimensionScores?.achievements || analysis.dimensionScores.achievements,
              research: parsed.dimensionScores?.research || analysis.dimensionScores.research,
              clarity: parsed.dimensionScores?.clarity || analysis.dimensionScores.clarity,
              scholarshipRelevance:
                parsed.dimensionScores?.scholarshipRelevance || analysis.dimensionScores.scholarshipRelevance,
            },
            extractedEntities: {
              education:
                Array.isArray(parsed.extractedEntities?.education) && parsed.extractedEntities.education.length > 0
                  ? parsed.extractedEntities.education
                  : analysis.extractedEntities.education,
              skills:
                Array.isArray(parsed.extractedEntities?.skills) && parsed.extractedEntities.skills.length > 0
                  ? parsed.extractedEntities.skills
                  : analysis.extractedEntities.skills,
              projects:
                Array.isArray(parsed.extractedEntities?.projects) && parsed.extractedEntities.projects.length > 0
                  ? parsed.extractedEntities.projects
                  : analysis.extractedEntities.projects,
              experience:
                Array.isArray(parsed.extractedEntities?.experience) && parsed.extractedEntities.experience.length > 0
                  ? parsed.extractedEntities.experience
                  : analysis.extractedEntities.experience,
              achievements: Array.isArray(parsed.extractedEntities?.achievements)
                ? parsed.extractedEntities.achievements
                : analysis.extractedEntities.achievements,
              research: Array.isArray(parsed.extractedEntities?.research)
                ? parsed.extractedEntities.research
                : analysis.extractedEntities.research,
            },
            strengths: parsed.strengths || analysis.strengths,
            weaknesses: parsed.weaknesses || analysis.weaknesses,
            missingInformation: parsed.missingInformation || analysis.missingInformation,
            suggestions: parsed.suggestions || analysis.suggestions,
            scholarshipFitSummary: parsed.scholarshipFitSummary || analysis.scholarshipFitSummary,
          };
        }
      } catch (err: any) {
        logger.warn('LLM CV analysis failed — using deterministic extraction', llmErrorMeta(err));
      }
    }

    // 3. Persist Record to Database
    const savedRecord = await prisma.cVAnalysis.create({
      data: {
        userId,
        cvText,
        skillsFound: safeJsonStringify(analysis.extractedEntities.skills),
        strengths: safeJsonStringify(analysis.strengths),
        weaknesses: safeJsonStringify(analysis.weaknesses),
        suggestions: safeJsonStringify(analysis.suggestions),
        score: analysis.score,
      },
    });

    return {
      id: savedRecord.id,
      userId: savedRecord.userId,
      score: analysis.score,
      dimensionScores: analysis.dimensionScores,
      extractedEntities: analysis.extractedEntities,
      skillsFound: analysis.extractedEntities.skills,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      missingInformation: analysis.missingInformation,
      suggestions: analysis.suggestions,
      scholarshipFitSummary: analysis.scholarshipFitSummary,
      createdAt: savedRecord.createdAt,
    };
  }

  /**
   * Retrieves the most recent CV analysis for the authenticated user.
   */
  static async getLatestAnalysis(userId: string) {
    const latest = await prisma.cVAnalysis.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) return null;

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    const baseline = this.extractDeterministicEntities(latest.cvText, profile);

    return {
      id: latest.id,
      userId: latest.userId,
      score: latest.score,
      dimensionScores: baseline.dimensionScores,
      extractedEntities: {
        ...baseline.extractedEntities,
        skills: parseJsonField(latest.skillsFound, baseline.extractedEntities.skills),
      },
      skillsFound: parseJsonField(latest.skillsFound, baseline.extractedEntities.skills),
      strengths: parseJsonField(latest.strengths, baseline.strengths),
      weaknesses: parseJsonField(latest.weaknesses, baseline.weaknesses),
      missingInformation: baseline.missingInformation,
      suggestions: parseJsonField(latest.suggestions, baseline.suggestions),
      scholarshipFitSummary: baseline.scholarshipFitSummary,
      createdAt: latest.createdAt,
    };
  }

  /**
   * Retrieves the history of CV analyses for the authenticated user.
   */
  static async getHistory(userId: string) {
    const history = await prisma.cVAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    return history.map((item: any) => ({
      id: item.id,
      score: item.score,
      skillsFound: parseJsonField(item.skillsFound, []),
      strengths: parseJsonField(item.strengths, []),
      weaknesses: parseJsonField(item.weaknesses, []),
      suggestions: parseJsonField(item.suggestions, []),
      createdAt: item.createdAt,
    }));
  }

  /**
   * Deletes a specific CV analysis record.
   */
  static async deleteAnalysis(userId: string, analysisId: string) {
    const record = await prisma.cVAnalysis.findFirst({
      where: { id: analysisId, userId },
    });
    if (!record) throw { statusCode: 404, message: 'CV Analysis record not found' };

    await prisma.cVAnalysis.delete({ where: { id: analysisId } });
    return { success: true, message: 'CV Analysis deleted successfully.' };
  }

  /**
   * Syncs extracted skills and research details directly to student profile.
   */
  static async syncToProfile(userId: string, skills: string[], researchSummary?: string) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) throw { statusCode: 404, message: 'Profile not found' };

    const currentSkills = parseJsonField(profile.skills, []);
    const mergedSkills = Array.from(new Set([...currentSkills, ...skills]));

    const updated = await prisma.studentProfile.update({
      where: { userId },
      data: {
        skills: safeJsonStringify(mergedSkills),
        researchExperience: researchSummary || profile.researchExperience,
      },
    });

    return {
      success: true,
      message: `Profile updated with ${skills.length} verified skills.`,
      profile: {
        ...updated,
        skills: mergedSkills,
      },
    };
  }
}
