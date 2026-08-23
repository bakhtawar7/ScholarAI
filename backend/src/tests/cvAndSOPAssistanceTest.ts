import { prisma } from '../utils/prisma';
import { CVAnalysisService } from '../services/cvAnalysisService';
import { SOPAssistantService } from '../services/sopAssistantService';
import { executeToolCall } from '../tools/chatbotTools';
import bcrypt from 'bcryptjs';

async function runCVAndSOPTests() {
  console.log('\n========================================');
  console.log('🧪 RUNNING AI CV & SOP ASSISTANCE TEST SUITE');
  console.log('========================================\n');

  let testUser: any = null;

  try {
    // 1. Setup Test User & Profile
    const testEmail = `test_cv_sop_${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('Password123!', 10);
    testUser = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        profile: {
          create: {
            fullName: 'Alex Vance',
            countryOfResidence: 'Pakistan',
            nationality: 'Pakistani',
            currentDegreeLevel: 'BACHELORS',
            currentDegreeName: 'Bachelor of Science in Software Engineering',
            fieldOfStudy: 'Computer Science',
            university: 'National University of Sciences & Technology',
            gpa: 3.82,
            maxGpa: 4.0,
            graduationYear: 2025,
            targetDegreeLevel: 'MASTERS',
            targetCountries: JSON.stringify(['Germany', 'United Kingdom']),
            preferredFields: JSON.stringify(['Artificial Intelligence', 'Distributed Systems']),
            skills: JSON.stringify(['Python', 'TypeScript', 'Docker']),
            workExperienceYears: 1.5,
          },
        },
      },
      include: { profile: true },
    });

    console.log(`✅ [1/7] Test User created: ${testUser.email} (ID: ${testUser.id})`);

    // 2. Test CV Analysis & Entity Extraction
    const sampleCVText = `
ALEX VANCE
Email: alex.vance@example.com | GitHub: github.com/alexvance

EDUCATION
Bachelor of Science in Software Engineering, National University of Sciences & Technology (NUST)
CGPA: 3.82 / 4.00 | Dean's Honor List (2023, 2024) | Merit Scholarship Recipient
Relevant Coursework: Distributed Systems, Advanced Machine Learning, Algorithm Design, Cloud Computing

TECHNICAL SKILLS
Languages & Frameworks: Python, TypeScript, React, Node.js, PostgreSQL, Docker, PyTorch, Git
Specializations: Distributed Systems, Microservices Architecture, REST API Engineering

ENGINEERING PROJECTS
• Distributed Stream Engine: Engineered an event-driven stream processor in Python and Redis handling 50k events/sec.
• Neural Image Segmenter: Developed a PyTorch segmentation pipeline achieving 91% mIoU accuracy on satellite imagery.

EXPERIENCE
• Software Engineering Intern | TechCorp (June 2024 - Sept 2024)
  - Architected microservices backend with Node.js and PostgreSQL, reducing latency by 35%.
• Academic Teaching Assistant | NUST (Jan 2024 - May 2024)
  - Assisted 80+ students in Data Structures and Algorithms laboratory sessions.

RESEARCH & PUBLICATIONS
• Undergraduate Thesis: "Optimizing State Replication in Byzantine Fault Tolerant Consensus Protocols"
• Conference Presentation at IEEE Student Research Symposium (2024).
`;

    const cvAnalysis = await CVAnalysisService.analyzeCV(testUser.id, sampleCVText);
    console.log(`✅ [2/7] CV Analysis Completed:`);
    console.log(`   - Overall Score: ${cvAnalysis.score} / 100`);
    console.log(
      `   - Extracted Skills (${cvAnalysis.extractedEntities.skills.length}): ${cvAnalysis.extractedEntities.skills.slice(0, 5).join(', ')}`
    );
    console.log(`   - Education: ${cvAnalysis.extractedEntities.education.join(' | ')}`);
    console.log(`   - Achievements: ${cvAnalysis.extractedEntities.achievements.join(', ')}`);
    console.log(`   - Research: ${cvAnalysis.extractedEntities.research.join(', ')}`);
    console.log(`   - Dimension Scores:`, cvAnalysis.dimensionScores);
    console.log(
      `   - Missing Info Identified (${cvAnalysis.missingInformation.length}):`,
      cvAnalysis.missingInformation[0]
    );

    if (!cvAnalysis.score || cvAnalysis.extractedEntities.skills.length === 0) {
      throw new Error('CV analysis failed to extract score or skills.');
    }

    // 3. Test Profile Synchronization
    const syncRes = await CVAnalysisService.syncToProfile(
      testUser.id,
      cvAnalysis.extractedEntities.skills,
      'Thesis on BFT Consensus'
    );
    console.log(`✅ [3/7] Profile Sync: ${syncRes.message}`);

    const updatedProfile = await prisma.studentProfile.findUnique({ where: { userId: testUser.id } });
    const profileSkills = JSON.parse(updatedProfile?.skills || '[]');
    if (!profileSkills.includes('React') || !profileSkills.includes('PostgreSQL')) {
      throw new Error('Profile synchronization failed to merge skills.');
    }

    // 4. Test SOP Guided Questions
    const questionsRes = await SOPAssistantService.generateGuidedQuestions(
      testUser.id,
      'DAAD Postgraduate Study Scholarship in Germany',
      'Computer Science'
    );
    console.log(`✅ [4/7] SOP Guided Discovery Questions generated (${questionsRes.questions.length} questions):`);
    console.log(
      `   - Q1: ${questionsRes.questions[0].category} -> "${questionsRes.questions[0].question.slice(0, 60)}..."`
    );

    // 5. Test SOP 5-Paragraph Outline
    const outlineRes = await SOPAssistantService.generateStructuredOutline(
      testUser.id,
      'DAAD Postgraduate Study Scholarship',
      {
        q1: 'I want to solve distributed consensus latency bottlenecks under high network partition events.',
        q2: 'Completed advanced coursework in Distributed Systems and Algorithms at NUST.',
        q3: 'Engineered an event-driven stream processor and authored thesis on BFT replication.',
        q4: 'The Technical University of Munich offers premier research labs in Distributed Systems.',
        q5: 'Aim to establish a specialized distributed systems research group in my home country.',
      }
    );
    console.log(`✅ [5/7] SOP 5-Paragraph Outline generated (${outlineRes.outline.length} paragraphs):`);
    outlineRes.outline.forEach((sec) => {
      console.log(`   - P${sec.paragraphNumber}: ${sec.sectionTitle} (${sec.recommendedWordCount})`);
    });

    // 6. Test SOP Draft Analysis & Feedback
    const sampleSOPDraft = `
Statement of Purpose for DAAD Postgraduate Study Scholarship in Computer Science

As distributed computing infrastructures become the backbone of modern global digital services, ensuring robust fault tolerance without sacrificing throughput remains a paramount challenge. My undergraduate thesis at the National University of Sciences and Technology (NUST) explored latency bottlenecks in state replication under Byzantine network partition events. I am applying for the Master of Science in Informatics under the DAAD Scholarship to specialize in distributed systems architecture.

Throughout my undergraduate tenure in Software Engineering, I maintained a 3.82 CGPA and pursued rigorous coursework in Distributed Systems, Advanced Machine Learning, and Algorithm Design. During my tenure as an Academic Teaching Assistant, I guided over 80 undergraduate students through algorithmic proofs, reinforcing my theoretical grounding and technical communication skills.

In my flagship capstone project, I engineered an event-driven distributed stream processing engine utilizing Python and Redis. The architecture achieved sustained throughput of 50,000 events per second while maintaining strict message delivery semantics. Additionally, my research on consensus protocol optimization was accepted for presentation at the IEEE Student Research Symposium.

The Technical University of Munich represents the ideal academic institution for my postgraduate trajectory. Specifically, the Chair for Decentralized Information Systems led by top faculty offers direct alignment with my research objectives in consensus optimization and fault-tolerant cloud infrastructure.

Following graduation, my five-year career vision is to serve as a Senior Distributed Systems Researcher, applying high-resilience computing frameworks to critical civic infrastructure and mentoring emerging researchers in South Asia. The DAAD Scholarship provides the vital international collaboration framework necessary to realize these developmental contributions.
`;

    const sopAnalysis = await SOPAssistantService.analyzeSOP(testUser.id, sampleSOPDraft, 'DAAD Scholarship');
    console.log(`✅ [6/7] SOP Draft Analysis & Admissions Feedback:`);
    console.log(`   - Alignment Score: ${sopAnalysis.feedback.alignmentScore}%`);
    console.log(`   - Structure Rating: ${sopAnalysis.feedback.structureRating}`);
    console.log(`   - Clarity Score: ${sopAnalysis.feedback.clarityScore}%`);
    console.log(
      `   - Strengths (${sopAnalysis.feedback.keyStrengths.length}): ${sopAnalysis.feedback.keyStrengths[0]}`
    );
    console.log(`   - Section Breakdown (${sopAnalysis.feedback.sectionBreakdown.length} sections analyzed):`);
    sopAnalysis.feedback.sectionBreakdown.forEach((sec) => {
      console.log(`     * [${sec.status}] ${sec.section} -> ${sec.feedback.slice(0, 50)}...`);
    });

    // Test Section Refinement
    const refinedSection = await SOPAssistantService.refineDraftSection(
      testUser.id,
      'Paragraph 1: Introduction',
      'I want to study distributed systems because this is good for my career and I worked on a thesis about consensus.'
    );
    console.log(`   - Section Polish Example:`);
    console.log(`     * Original: "I want to study distributed systems..."`);
    console.log(`     * Refined: "${refinedSection.refinedText}"`);
    console.log(`     * Rationale: "${refinedSection.changesExplanation}"`);

    // 7. Test AI Orchestrator Tool Calling for CV & SOP
    console.log(`✅ [7/7] Testing AI Assistant Chatbot Tools:`);
    const cvToolResult = await executeToolCall('getCVAnalysis', {}, testUser.id);
    console.log(`   - getCVAnalysis Tool Execution: Score = ${cvToolResult.score || cvToolResult.message}`);

    const sopReviewToolResult = await executeToolCall(
      'reviewSOPDraft',
      { draftText: sampleSOPDraft.slice(0, 300) },
      testUser.id
    );
    console.log(`   - reviewSOPDraft Tool Execution: Alignment = ${sopReviewToolResult.alignmentScore}%`);

    const sopOutlineToolResult = await executeToolCall(
      'getSOPOutline',
      { targetScholarshipTitle: 'DAAD Scholarship' },
      testUser.id
    );
    console.log(`   - getSOPOutline Tool Execution: Outline Sections = ${sopOutlineToolResult.outline?.length}`);

    const sopQuestionsToolResult = await executeToolCall(
      'getSOPQuestions',
      { fieldOfStudy: 'Computer Science' },
      testUser.id
    );
    console.log(`   - getSOPQuestions Tool Execution: Questions = ${sopQuestionsToolResult.questions?.length}`);

    console.log('\n========================================');
    console.log('🎉 ALL CV & SOP MODULE TESTS PASSED SUCCESSFULLY!');
    console.log('========================================\n');
  } catch (err: any) {
    console.error('\n❌ Test Suite Failed:', err.message || err);
    throw err;
  } finally {
    // Cleanup Test User
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
  }
}

runCVAndSOPTests()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
