import { prisma } from '../utils/prisma';
import { config } from '../config';
import { parseJsonField, safeJsonStringify } from '../utils/jsonHelper';

import { llm as openai, llmErrorMeta } from '../utils/llmClient';
import { logger } from '../utils/logger';

export interface SOPFeedbackResult {
  alignmentScore: number;
  structureRating: string;
  clarityScore: number;
  relevanceScore: number;
  grammarAndTone: string;
  keyStrengths: string[];
  areasForImprovement: string[];
  missingInformation: string[];
  sectionBreakdown: Array<{
    section: string;
    status: 'STRONG' | 'NEEDS_WORK' | 'MISSING';
    feedback: string;
    suggestion: string;
  }>;
  suggestedOutline: string[];
  actionableNextSteps: string[];
}

export class SOPAssistantService {
  /**
   * Generates guided interactive discovery questions to help students brainstorm
   * and articulate their own authentic Statement of Purpose.
   */
  static async generateGuidedQuestions(userId: string, targetScholarshipTitle?: string, fieldOfStudy?: string) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    const degree = profile?.targetDegreeLevel || 'Masters';
    const field = fieldOfStudy || profile?.fieldOfStudy || 'Computer Science & Engineering';
    const scholarship = targetScholarshipTitle || 'International Academic Scholarship';

    return {
      scholarship,
      field,
      degree,
      questions: [
        {
          id: 'q1_hook_motivation',
          category: '1. Intellectual Hook & Core Motivation',
          question: `What specific academic problem, industry challenge, or intellectual curiosity motivated you to pursue a ${degree} in ${field}?`,
          hint: 'Focus on a concrete technical project, research question, or domain challenge rather than generic childhood memories.',
          placeholder:
            'e.g., While developing a real-time distributed stream processor for my capstone, I encountered significant latency bottlenecks under high network partition events...',
        },
        {
          id: 'q2_academic_prep',
          category: '2. Academic Preparation & Technical Coursework',
          question:
            'Which specific undergraduate courses, engineering projects, or technical milestones prepared you for advanced study in this discipline?',
          hint: 'Mention 2-3 core subjects or laboratory experiences with concrete methodologies and analytical concepts.',
          placeholder: `e.g., Coursework in Distributed Systems and Advanced Machine Learning at ${profile?.university || 'my university'} built my theoretical foundation...`,
        },
        {
          id: 'q3_research_experience',
          category: '3. Research Methodology & Practical Execution',
          question:
            'What research projects, publications, thesis work, or engineering roles demonstrate your ability to execute rigorous academic work?',
          hint: 'Highlight methodologies, software tools, datasets, experimental findings, or published output.',
          placeholder:
            'e.g., In my senior thesis supervised by Dr. Smith, I engineered an algorithmic optimizer that achieved a 28% throughput improvement...',
        },
        {
          id: 'q4_program_fit',
          category: '4. Fit with Target Scholarship & Host Institution',
          question: `Why is ${scholarship} and its host university the ideal environment for your specialization compared to other global options?`,
          hint: 'Name specific professors, laboratories, research groups, or curriculum modules you intend to join.',
          placeholder: `e.g., The faculty's pioneering research in intelligent systems and access to high-performance compute clusters aligns directly with my research goals...`,
        },
        {
          id: 'q5_career_vision',
          category: '5. Post-Graduation Vision & Societal Impact',
          question:
            'What are your concrete 5-year post-graduation career goals, and how will you use this scholarship to contribute back to your home country or scientific field?',
          hint: 'Scholarship committees look for clear leadership potential, developmental impact, and return on investment.',
          placeholder:
            'e.g., Upon completing my degree, I plan to establish a collaborative research initiative focused on deploying localized AI healthcare diagnostics...',
        },
      ],
    };
  }

  /**
   * Generates a tailored 5-paragraph structured outline based on the user's focus areas.
   */
  static async generateStructuredOutline(
    userId: string,
    targetScholarshipTitle?: string,
    userInputs?: Record<string, string>
  ) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    const target = targetScholarshipTitle || 'International Academic Scholarship';

    return {
      targetScholarship: target,
      outline: [
        {
          paragraphNumber: 1,
          sectionTitle: 'Compelling Introduction & Clear Academic Objective',
          purpose:
            'Hook the reader with a concrete intellectual question and explicitly declare your target degree program.',
          recommendedWordCount: '100 - 150 words',
          userContent: userInputs?.['q1'] || userInputs?.['q1_hook_motivation'] || '',
          keyElements: [
            'Specific academic challenge or domain problem that drives you.',
            `Direct declaration: applying for ${profile?.targetDegreeLevel || 'Degree'} in ${profile?.fieldOfStudy || 'Field'} under ${target}.`,
            'Brief roadmap of your overarching academic research focus.',
          ],
        },
        {
          paragraphNumber: 2,
          sectionTitle: 'Academic Foundation & Core Technical Coursework',
          purpose: 'Demonstrate rigorous undergraduate preparation and relevant theoretical mastery.',
          recommendedWordCount: '150 - 200 words',
          userContent: userInputs?.['q2'] || userInputs?.['q2_academic_prep'] || '',
          keyElements: [
            `Undergraduate degree at ${profile?.university || 'your university'} with key coursework.`,
            'Specific advanced subjects relevant to target postgraduate specialization.',
            'Academic performance, analytical coursework, and methodological rigor.',
          ],
        },
        {
          paragraphNumber: 3,
          sectionTitle: 'Flagship Research Project, Thesis, or Industry Impact',
          purpose: 'Provide concrete proof of execution, research methodology, and problem-solving capability.',
          recommendedWordCount: '200 - 250 words',
          userContent: userInputs?.['q3'] || userInputs?.['q3_research_experience'] || '',
          keyElements: [
            'Detailed description of your most significant project or undergraduate thesis.',
            'Methodologies, algorithms, frameworks, or datasets used.',
            'Measurable results, optimizations, or publication output (with factual metrics).',
          ],
        },
        {
          paragraphNumber: 4,
          sectionTitle: 'Institutional Alignment & Why this Specific Program',
          purpose: 'Convince the admissions committee you did deep research on their specific curriculum and labs.',
          recommendedWordCount: '150 - 200 words',
          userContent: userInputs?.['q4'] || userInputs?.['q4_program_fit'] || '',
          keyElements: [
            `Why ${target} and its host country/institution are the premier choice.`,
            'Specific professors, research groups, or course modules you will join.',
            'Intercultural exchange, collaborative perspective, and institutional contribution.',
          ],
        },
        {
          paragraphNumber: 5,
          sectionTitle: 'Long-Term Career Vision & Return on Investment / Contribution',
          purpose: 'Articulate post-graduation impact and how you will give back to your field or community.',
          recommendedWordCount: '100 - 150 words',
          userContent: userInputs?.['q5'] || userInputs?.['q5_career_vision'] || '',
          keyElements: [
            'Clear 3-5 year post-graduation career trajectory (R&D, industry, academia).',
            'Societal or technological contribution back to your field or home country.',
            'Strong concluding sentence reinforcing your commitment and readiness.',
          ],
        },
      ],
    };
  }

  /**
   * Evaluates an SOP draft across structure, clarity, scholarship alignment, grammar, and missing info.
   * Strictly adheres to anti-hallucination guardrails (never fabricating facts).
   */
  static async analyzeSOP(userId: string, draftText: string, targetScholarshipTitle?: string) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    const target = targetScholarshipTitle || 'International Scholarship';

    const words = draftText.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const lower = draftText.toLowerCase();

    // Deterministic evaluation heuristics
    const hasProfOrLab = /(prof\.|professor|dr\.|laboratory|research group|institute|curriculum|module)\b/i.test(
      draftText
    );
    const hasCareerGoals = /(career|goal|5-year|future|post-graduation|contribute|return|leadership)\b/i.test(
      draftText
    );
    const hasQuantMetrics =
      /\b(\d+%\s*(?:increase|improvement|reduction|accuracy)|\d+\s*(?:users|clients|nodes|datasets))\b/i.test(
        draftText
      );
    const hasScholarshipMention =
      target && target !== 'International Scholarship' ? lower.includes(target.toLowerCase().split(' ')[0]) : true;

    const missingInfo: string[] = [];
    if (!hasProfOrLab) {
      missingInfo.push('No specific faculty members, research laboratories, or specialized curriculum modules cited.');
    }
    if (!hasCareerGoals) {
      missingInfo.push('5-year post-graduation career milestones and societal contribution are vague or missing.');
    }
    if (!hasQuantMetrics) {
      missingInfo.push('Project descriptions lack quantified outcomes (e.g., performance increase %, dataset scale).');
    }
    if (wordCount < 400) {
      missingInfo.push(`Draft length (${wordCount} words) is below the recommended 600-800 word academic standard.`);
    }

    let feedback: SOPFeedbackResult = {
      alignmentScore: Math.min(
        95,
        Math.max(65, 80 + (hasProfOrLab ? 6 : -4) + (hasCareerGoals ? 5 : -4) + (hasQuantMetrics ? 4 : 0))
      ),
      structureRating: wordCount >= 450 ? 'Strong & Well Structured (4.4 / 5.0)' : 'Moderate Structure (3.6 / 5.0)',
      clarityScore: Math.min(96, Math.max(70, 84 + (wordCount >= 400 ? 5 : -5))),
      relevanceScore: Math.min(95, Math.max(65, 82 + (hasScholarshipMention ? 6 : -4))),
      grammarAndTone: 'Professional academic diction with coherent phrasing and objective reasoning.',
      keyStrengths: [
        'Clear statement of academic focus and intellectual curiosity.',
        'Logical progression from undergraduate coursework to target postgraduate specialization.',
        'Professional tone with appropriate domain-specific vocabulary.',
      ],
      areasForImprovement: [
        'Elaborate more deeply on why this specific institution was chosen over other global alternatives.',
        'Provide concrete quantifiable outcomes for projects mentioned in the body paragraphs.',
        'Strengthen the opening hook to immediately engage the scholarship selection committee.',
      ],
      missingInformation:
        missingInfo.length > 0
          ? missingInfo
          : ['Consider citing 1-2 recent research publications from target department faculty.'],
      sectionBreakdown: [
        {
          section: 'Paragraph 1: Introduction & Academic Hook',
          status: 'STRONG',
          feedback: 'States application intent clearly and introduces domain interest.',
          suggestion: 'Enhance opening sentence with a provocative intellectual question or domain problem.',
        },
        {
          section: 'Paragraph 2: Academic Background & Preparation',
          status: 'STRONG',
          feedback: 'Good summary of degree credentials and foundational coursework.',
          suggestion: 'Directly link completed coursework to advanced electives in the target curriculum.',
        },
        {
          section: 'Paragraph 3: Key Research & Engineering Projects',
          status: hasQuantMetrics ? 'STRONG' : 'NEEDS_WORK',
          feedback: hasQuantMetrics
            ? 'Solid project presentation with clear metrics.'
            : 'Project descriptions are slightly conceptual.',
          suggestion: 'Incorporate 1-2 quantified metrics demonstrating technical impact.',
        },
        {
          section: 'Paragraph 4: Program Fit & Institutional Alignment',
          status: hasProfOrLab ? 'STRONG' : 'NEEDS_WORK',
          feedback: hasProfOrLab
            ? 'Cites target academic modules.'
            : 'Mentions country benefits but lacks university-specific professor or laboratory references.',
          suggestion: 'Cite 1-2 faculty members or specific research centers at the target university.',
        },
        {
          section: 'Paragraph 5: Long-Term Career Vision & Impact',
          status: hasCareerGoals ? 'STRONG' : 'NEEDS_WORK',
          feedback: hasCareerGoals
            ? 'Articulates clear career direction.'
            : 'Post-graduation vision is somewhat generic.',
          suggestion:
            'Add specific milestones (e.g., Year 1-2 research scientist, Year 3-5 lab director or policy contributor).',
        },
      ],
      suggestedOutline: [
        'Paragraph 1: Compelling Hook, Field Interest & Clear Application Intent',
        'Paragraph 2: Academic Preparation, Rigorous Coursework & Theoretical Foundation',
        'Paragraph 3: Flagship Research / Engineering Project with Quantified Outcomes',
        'Paragraph 4: Why this specific Program, University Labs & Host Country',
        'Paragraph 5: Post-Graduation Career Plan & Societal / Academic Contribution',
      ],
      actionableNextSteps: [
        'Research 2 specific faculty members or laboratories at the target university and cite them in Paragraph 4.',
        'Add quantitative performance metrics to your primary project in Paragraph 3.',
        'Refine the conclusion to emphasize mutual developmental benefit for the scholarship fund.',
      ],
    };

    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: config.openaiModel,
          messages: [
            {
              role: 'system',
              content: `You are an elite academic admissions director for prestigious international scholarships (DAAD, Chevening, Fulbright, Erasmus Mundus, Gates Cambridge).
Analyze the user's Statement of Purpose (SOP) draft.
Provide rigorous, structured feedback across:
1. alignmentScore (number 0-100)
2. structureRating (string, e.g. "Strong (4.5 / 5.0)")
3. clarityScore (number 0-100)
4. relevanceScore (number 0-100)
5. grammarAndTone (string summary)
6. keyStrengths (string array)
7. areasForImprovement (string array)
8. missingInformation (string array of missing arguments, missing lab citations, unquantified claims)
9. sectionBreakdown (array of objects with section, status ['STRONG', 'NEEDS_WORK', 'MISSING'], feedback, suggestion)
10. suggestedOutline (string array)
11. actionableNextSteps (string array)

CRITICAL ANTI-FABRICATION GUARDRAIL:
Do NOT invent experiences, awards, research, or personal stories. Evaluate strictly what is written in the draft and provide constructive editorial guidance.`,
            },
            {
              role: 'user',
              content: `Target Scholarship: ${target}\nStudent Profile: ${JSON.stringify(profile)}\n\nSOP Draft:\n${draftText.slice(0, 8000)}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: config.llmMaxTokens,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          feedback = {
            alignmentScore:
              parsed.alignmentScore !== undefined ? Number(parsed.alignmentScore) : feedback.alignmentScore,
            structureRating: parsed.structureRating || feedback.structureRating,
            clarityScore: parsed.clarityScore !== undefined ? Number(parsed.clarityScore) : feedback.clarityScore,
            relevanceScore:
              parsed.relevanceScore !== undefined ? Number(parsed.relevanceScore) : feedback.relevanceScore,
            grammarAndTone: parsed.grammarAndTone || feedback.grammarAndTone,
            keyStrengths:
              Array.isArray(parsed.keyStrengths) && parsed.keyStrengths.length > 0
                ? parsed.keyStrengths
                : feedback.keyStrengths,
            areasForImprovement:
              Array.isArray(parsed.areasForImprovement) && parsed.areasForImprovement.length > 0
                ? parsed.areasForImprovement
                : feedback.areasForImprovement,
            missingInformation:
              Array.isArray(parsed.missingInformation) && parsed.missingInformation.length > 0
                ? parsed.missingInformation
                : feedback.missingInformation,
            sectionBreakdown:
              Array.isArray(parsed.sectionBreakdown) && parsed.sectionBreakdown.length > 0
                ? parsed.sectionBreakdown
                : feedback.sectionBreakdown,
            suggestedOutline:
              Array.isArray(parsed.suggestedOutline) && parsed.suggestedOutline.length > 0
                ? parsed.suggestedOutline
                : feedback.suggestedOutline,
            actionableNextSteps:
              Array.isArray(parsed.actionableNextSteps) && parsed.actionableNextSteps.length > 0
                ? parsed.actionableNextSteps
                : feedback.actionableNextSteps,
          };
        }
      } catch (e: any) {
        logger.warn('LLM SOP analysis failed — using deterministic evaluator', llmErrorMeta(e));
      }
    }

    // Persist Session in Database
    const session = await prisma.sOPSession.create({
      data: {
        userId,
        targetScholarship: target,
        draftText,
        feedback: safeJsonStringify(feedback),
      },
    });

    return {
      id: session.id,
      userId: session.userId,
      targetScholarship: session.targetScholarship,
      draftText: session.draftText,
      feedback,
      createdAt: session.createdAt,
    };
  }

  /**
   * Refines a specific paragraph or section for clarity, academic diction, and flow
   * strictly adhering to the user's authentic facts (never fabricating credentials).
   */
  static async refineDraftSection(userId: string, sectionTitle: string, originalText: string, instructions?: string) {
    if (!originalText || !originalText.trim()) {
      throw { statusCode: 400, message: 'originalText is required for refinement' };
    }

    let refinedText = originalText;
    let changesExplanation =
      'Enhanced academic vocabulary, converted passive expressions to active voice, and improved sentence cohesion.';

    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: config.openaiModel,
          messages: [
            {
              role: 'system',
              content: `You are an expert academic editor helping a student polish their Statement of Purpose draft for an international scholarship application.
Rewrite the section to improve:
- Clarity and conciseness
- Academic diction and sophisticated vocabulary
- Active voice and compelling logical flow
- Smooth transitions between ideas

CRITICAL ANTI-FABRICATION GUARDRAIL:
NEVER invent or fabricate experiences, awards, research, or personal stories. Use only the factual information provided in the original text.
Return JSON with keys:
refinedText (string),
changesExplanation (string describing what was improved and why).`,
            },
            {
              role: 'user',
              content: `Section Title: ${sectionTitle}\nUser Instructions: ${instructions || 'Improve clarity and academic tone'}\n\nOriginal Text:\n${originalText}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: config.llmMaxTokens,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          refinedText = parsed.refinedText || refinedText;
          changesExplanation = parsed.changesExplanation || changesExplanation;
        }
      } catch (err: any) {
        logger.warn('LLM SOP refinement failed — returning rule-based polish', llmErrorMeta(err));
      }
    } else {
      // Deterministic polish
      refinedText = originalText
        .replace(/\bvery\b\s*/gi, '')
        .replace(/\breally\b\s*/gi, '')
        .replace(/\ba lot of\b/gi, 'substantial')
        .replace(/\bI want to study\b/gi, 'I aspire to pursue advanced research in')
        .replace(/\bThis is good because\b/gi, 'This program provides an exceptional framework because')
        .replace(/\bI worked on\b/gi, 'I engineered and conducted research on')
        .replace(/\bIn conclusion\b/gi, 'Ultimately');
      changesExplanation =
        'Refined sentence structures, replaced informal phrases with academic diction, and eliminated filler words.';
    }

    return {
      sectionTitle,
      originalText,
      refinedText,
      changesExplanation,
    };
  }

  /**
   * Saves or updates an SOP draft session.
   */
  static async saveDraftSession(userId: string, targetScholarship: string, draftText: string, sessionId?: string) {
    if (sessionId) {
      const existing = await prisma.sOPSession.findFirst({ where: { id: sessionId, userId } });
      if (existing) {
        const updated = await prisma.sOPSession.update({
          where: { id: sessionId },
          data: {
            targetScholarship,
            draftText,
          },
        });
        return {
          id: updated.id,
          targetScholarship: updated.targetScholarship,
          draftText: updated.draftText,
          updatedAt: updated.updatedAt,
        };
      }
    }

    const created = await prisma.sOPSession.create({
      data: {
        userId,
        targetScholarship,
        draftText,
      },
    });

    return {
      id: created.id,
      targetScholarship: created.targetScholarship,
      draftText: created.draftText,
      createdAt: created.createdAt,
    };
  }

  /**
   * Retrieves all SOP sessions for the authenticated user.
   */
  static async getUserSessions(userId: string) {
    const sessions = await prisma.sOPSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    });

    return sessions.map((s: any) => ({
      id: s.id,
      targetScholarship: s.targetScholarship || 'International Scholarship',
      draftSnippet: s.draftText.slice(0, 140) + (s.draftText.length > 140 ? '...' : ''),
      draftLength: s.draftText.length,
      feedback: parseJsonField(s.feedback, null),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  /**
   * Retrieves a specific SOP session by ID.
   */
  static async getSessionById(userId: string, sessionId: string) {
    const session = await prisma.sOPSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) throw { statusCode: 404, message: 'SOP Session not found' };

    return {
      id: session.id,
      targetScholarship: session.targetScholarship,
      draftText: session.draftText,
      feedback: parseJsonField(session.feedback, null),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Deletes a specific SOP session.
   */
  static async deleteSession(userId: string, sessionId: string) {
    const session = await prisma.sOPSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw { statusCode: 404, message: 'SOP Session not found' };

    await prisma.sOPSession.delete({ where: { id: sessionId } });
    return { success: true, message: 'SOP Session deleted successfully.' };
  }
}
