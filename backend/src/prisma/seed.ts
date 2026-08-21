import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting SQLite database seed with DEMO DATA...');

  // Clean existing data
  await prisma.workflowRun.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.applicationChecklist.deleteMany();
  await prisma.application.deleteMany();
  await prisma.savedScholarship.deleteMany();
  await prisma.scholarshipMatch.deleteMany();
  await prisma.scholarshipVerification.deleteMany();
  await prisma.scholarshipSource.deleteMany();
  await prisma.scholarship.deleteMany();
  await prisma.cVAnalysis.deleteMany();
  await prisma.sOPSession.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatConversation.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.user.deleteMany();

  // Create Demo Users
  //
  // Password satisfies the production policy in authValidator.ts (>=10 chars, mixed case,
  // a digit). Cost factor matches BCRYPT_ROUNDS so seeded and registered users hash alike.
  const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
  const passwordHash = await bcrypt.hash('Password123!', rounds);

  const demoUser = await prisma.user.create({
    data: {
      email: 'student@example.com',
      passwordHash,
      role: 'STUDENT',
      isVerified: true,
      profile: {
        create: {
          fullName: 'Alex Vance',
          countryOfResidence: 'Pakistan',
          nationality: 'Pakistani',
          currentDegreeLevel: 'BACHELORS',
          currentDegreeName: 'B.S. Computer Science',
          fieldOfStudy: 'Computer Science',
          university: 'National University of Sciences and Technology (NUST)',
          gpa: 3.65,
          maxGpa: 4.0,
          graduationYear: 2025,
          targetDegreeLevel: 'MASTERS',
          targetCountries: JSON.stringify(['Germany', 'United Kingdom', 'Switzerland', 'Japan', 'United States', 'Singapore', 'Sweden']),
          preferredFields: JSON.stringify(['Computer Science', 'Artificial Intelligence', 'Data Science', 'Software Engineering', 'Robotics']),
          languageTests: JSON.stringify({ IELTS: 7.5, TOEFL: 105 }),
          financialPreference: 'Full Funding Required',
          scholarshipPreference: 'Merit-Based International Scholarships',
          skills: JSON.stringify(['Python', 'TypeScript', 'Machine Learning', 'React', 'Node.js', 'PyTorch']),
          workExperienceYears: 1.5,
          researchExperience: 'Co-authored a paper on Transformer Optimization for Edge Devices presented at IEEE student symposium.',
        },
      },
    },
    include: { profile: true },
  });

  console.log(`Created demo student: ${demoUser.email} (password: Password123!)`);

  // Administrator account.
  //
  // Catalogue writes, the verification queue and the automation console all require
  // ADMIN. Authorization is granted by JWT role OR by membership of ADMIN_EMAILS, so
  // this account works out of the box while remaining configurable per environment.
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
      profile: {
        create: {
          fullName: 'Platform Administrator',
          countryOfResidence: 'Not Specified',
          nationality: 'Not Specified',
          currentDegreeLevel: 'MASTERS',
          currentDegreeName: 'Administrator',
          fieldOfStudy: 'Platform Operations',
          university: 'Not Specified',
          gpa: 0,
          maxGpa: 4.0,
          graduationYear: new Date().getFullYear(),
          targetDegreeLevel: 'MASTERS',
          targetCountries: JSON.stringify([]),
          preferredFields: JSON.stringify([]),
          languageTests: JSON.stringify({}),
          skills: JSON.stringify([]),
        },
      },
    },
  });

  console.log(`Created admin user:   ${adminUser.email} (password: Password123!)`);

  const scholarshipsData = [
    {
      title: 'Erasmus Mundus Joint Master in Artificial Intelligence (EMJMD AI)',
      provider: 'European Commission',
      university: 'UPC Barcelona, Radboud University & KU Leuven Consortium',
      organization: 'Erasmus+ European Education and Culture Executive Agency',
      hostCountry: 'Germany',
      degreeLevels: JSON.stringify(['MASTERS']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Artificial Intelligence', 'Data Science', 'Machine Learning']),
      fundingType: 'FULL_FUNDING',
      tuitionCoverage: '100% Full Tuition Exemption (€18,000/year waived)',
      stipendAmount: '€1,400 per month living allowance (up to 24 months)',
      travelAllowance: true,
      accommodationCoverage: true,
      accommodationDetails: 'University housing placement assistance and subsidized international student residence guarantee.',
      minGpa: 3.2,
      maxGpaScale: 4.0,
      gpaRequirements: 'Minimum cumulative GPA of 3.2/4.0 (or equivalent First Class / Upper Second Class honours) in Computer Science or related STEM field.',
      eligibleNationalities: JSON.stringify([]),
      nationalityRequirements: 'Open globally to all nationalities (Programme and Partner country quotas apply).',
      languageRequirements: JSON.stringify({ IELTS: 7.0, TOEFL: 95 }),
      eligibilityDescription: 'Applicants must hold an accredited Bachelor degree (180 ECTS min) in Computer Science, Mathematics, or Software Engineering with strong foundations in linear algebra, algorithms, and probability.',
      requiredDocuments: JSON.stringify([
        'Official Academic Transcripts & Grading Scale',
        'Bachelor Degree Certificate (or Enrollment Verification)',
        'Statement of Purpose (Max 1,000 words)',
        'Two Academic Letters of Recommendation',
        'Europass Format Curriculum Vitae (CV)',
        'Valid English Language Certificate (IELTS/TOEFL)',
        'Passport Identification Page',
      ]),
      applicationProcess: '1. Register on the EMJMD consortium application portal. 2. Select AI track mobility path. 3. Upload all notarized academic credentials and SOP. 4. Submit before the December consortium scholarship deadline.',
      deadline: new Date('2026-11-30'),
      officialUrl: 'https://erasmus-plus.ec.europa.eu/programmes/erasmus-mundus',
      sourceUrl: 'https://eacea.ec.europa.eu/erasmus-plus',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isDemo: true,
    },
    {
      title: 'DAAD EPOS Development-Related Postgraduate Scholarship',
      provider: 'German Academic Exchange Service (DAAD)',
      university: 'Participating Public German Universities (TUM, RWTH Aachen, Uni Bonn)',
      organization: 'DAAD Federal Ministry for Economic Cooperation and Development (BMZ)',
      hostCountry: 'Germany',
      degreeLevels: JSON.stringify(['MASTERS', 'PHD']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Engineering', 'Environmental Studies', 'Public Policy', 'Data Science']),
      fundingType: 'FULL_FUNDING',
      tuitionCoverage: '100% Tuition Exemption at all public German universities',
      stipendAmount: '€934/month (Masters) | €1,300/month (PhD candidates)',
      travelAllowance: true,
      accommodationCoverage: true,
      accommodationDetails: 'Monthly rent subsidy allowance plus comprehensive health, accident, and personal liability insurance covered.',
      minGpa: 3.0,
      maxGpaScale: 4.0,
      gpaRequirements: 'Minimum GPA of 3.0/4.0 in completed undergraduate study with above-average performance ratings.',
      eligibleNationalities: JSON.stringify([]),
      nationalityRequirements: 'Targeted for international graduates from developing and emerging countries (DAC List of ODA Recipients).',
      languageRequirements: JSON.stringify({ IELTS: 6.5, TOEFL: 80 }),
      eligibilityDescription: 'Candidates must possess at least 2 years of professional work experience following completion of their bachelor degree, and demonstrate direct relevance to sustainable socioeconomic development.',
      requiredDocuments: JSON.stringify([
        'DAAD Application Form for Research Grants and Study Scholarships',
        'Hand-signed Curriculum Vitae (Europass format)',
        'Hand-signed Letter of Motivation with reference to current occupation',
        'Letter of Recommendation from current employer',
        'Certificate of Employment confirming at least 2 years of work experience',
        'Academic Transcripts and Degree Certificates',
        'Proof of English/German Language Proficiency',
      ]),
      applicationProcess: 'Apply directly to the designated EPOS Master/PhD program coordinator at the chosen German university, specifying scholarship consideration.',
      deadline: new Date('2026-10-15'),
      officialUrl: 'https://www.daad.de/en/study-and-research-in-germany/scholarships/',
      sourceUrl: 'https://www.daad.de',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isDemo: true,
    },
    {
      title: 'Fulbright Foreign Student Fellowship Program',
      provider: 'United States Department of State (ECA)',
      university: 'Accredited Higher Education Institutions in the United States',
      organization: 'Bureau of Educational and Cultural Affairs / USEFP',
      hostCountry: 'United States',
      degreeLevels: JSON.stringify(['MASTERS', 'PHD']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Data Science', 'Engineering', 'Humanities', 'Biotechnology', 'Public Health']),
      fundingType: 'FULL_FUNDING',
      tuitionCoverage: 'Full Tuition Fee Coverage and University Mandatory Fees for entirety of program',
      stipendAmount: '$2,200 - $2,800 monthly living stipend (adjusted for metropolitan living costs)',
      travelAllowance: true,
      accommodationCoverage: true,
      accommodationDetails: 'Book allowance, settling-in allowance, and ASPE health benefits plan included.',
      minGpa: 3.5,
      maxGpaScale: 4.0,
      gpaRequirements: 'Minimum cumulative GPA of 3.5/4.0 (or top 15% class percentile).',
      eligibleNationalities: JSON.stringify([]),
      nationalityRequirements: 'Citizens of participating Fulbright partner nations globally (must reside in home country at time of application).',
      languageRequirements: JSON.stringify({ TOEFL: 100, GRE: 310, IELTS: 7.5 }),
      eligibilityDescription: 'Designed for young professionals and recent graduates demonstrating high academic merit, leadership potential, and commitment to cross-cultural exchange and home-country development.',
      requiredDocuments: JSON.stringify([
        'Official University Transcripts and Attested Degree Certificates',
        'Official GRE General Test Score Report',
        'Official TOEFL iBT or IELTS Test Score',
        'Three Confidential Letters of Recommendation',
        'Personal Statement Essay (650 words)',
        'Study/Research Objective Essay (800 words)',
        'Detailed Academic Curriculum Vitae',
      ]),
      applicationProcess: 'Submit your complete dossier through the official US Embassy / Binational Fulbright Commission online portal in your home country.',
      deadline: new Date('2026-09-01'),
      officialUrl: 'https://foreign.fulbrightonline.org/',
      sourceUrl: 'https://fulbright.state.gov',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isDemo: true,
    },
    {
      title: 'Chevening International Leadership Scholarship',
      provider: 'UK Foreign, Commonwealth & Development Office (FCDO)',
      university: 'All UK Universities (Oxford, Cambridge, Imperial, UCL, Edinburgh, Manchester)',
      organization: 'Association of Commonwealth Universities (ACU)',
      hostCountry: 'United Kingdom',
      degreeLevels: JSON.stringify(['MASTERS']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Artificial Intelligence', 'Business Administration', 'Public Policy', 'Data Science']),
      fundingType: 'FULL_FUNDING',
      tuitionCoverage: '100% Full Tuition Coverage for any approved 1-year Master degree course in the UK',
      stipendAmount: '£1,350/month (£1,650/month inside Greater London area)',
      travelAllowance: true,
      accommodationCoverage: true,
      accommodationDetails: 'Arrival allowance, homeward departure allowance, and UK visa application fee coverage.',
      minGpa: 3.0,
      maxGpaScale: 4.0,
      gpaRequirements: 'Equivalent to an upper second-class 2:1 honours degree in the UK (approx. 3.0+ / 4.0 GPA).',
      eligibleNationalities: JSON.stringify([]),
      nationalityRequirements: 'Open to citizens of Chevening-eligible countries (over 160 countries worldwide).',
      languageRequirements: JSON.stringify({ IELTS: 6.5, TOEFL: 90 }),
      eligibilityDescription: 'Requires at least 2,800 hours (approx. 2 years) of verifiable work experience, proven leadership skills, and clear strategy for creating positive change in home country upon return.',
      requiredDocuments: JSON.stringify([
        'Official Academic Transcripts and Degree Certificate',
        'Unconditional UK University Master Course Offer Letter (by July deadline)',
        'Two Comprehensive Professional / Academic References',
        'Four 500-Word Essays (Leadership, Networking, Studying in the UK, Career Plan)',
        'Valid International Passport',
      ]),
      applicationProcess: 'Submit your online application through Chevening portal including 4 mandatory essays; short-listed candidates undergo panel interview at British Embassy.',
      deadline: new Date('2026-11-05'),
      officialUrl: 'https://www.chevening.org/scholarships/',
      sourceUrl: 'https://www.chevening.org',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isDemo: true,
    },
    {
      title: 'Gates Cambridge Postgraduate Scholarship',
      provider: 'Bill & Melinda Gates Foundation',
      university: 'University of Cambridge',
      organization: 'Gates Cambridge Trust',
      hostCountry: 'United Kingdom',
      degreeLevels: JSON.stringify(['MASTERS', 'PHD']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Machine Learning', 'Physics', 'Biological Sciences', 'Mathematics']),
      fundingType: 'FULL_FUNDING',
      tuitionCoverage: 'Full University Composition Fee and College Fees covered',
      stipendAmount: '£20,000 per annum maintenance allowance (living stipend)',
      travelAllowance: true,
      accommodationCoverage: true,
      accommodationDetails: 'Single economy airfare at start and end of course, inbound visa costs, NHS immigration healthcare surcharge.',
      minGpa: 3.8,
      maxGpaScale: 4.0,
      gpaRequirements: 'Exceptional academic excellence (GPA 3.8+ / 4.0 or top 5% of graduating class).',
      eligibleNationalities: JSON.stringify([]),
      nationalityRequirements: 'Open to all citizens from outside the United Kingdom applying to study at Cambridge.',
      languageRequirements: JSON.stringify({ IELTS: 7.5, TOEFL: 110 }),
      eligibilityDescription: 'Candidates must demonstrate outstanding intellectual ability, reasons for choice of course, commitment to improving the lives of others, and leadership capacity.',
      requiredDocuments: JSON.stringify([
        'Cambridge Postgraduate Application Form',
        'Gates Cambridge Statement (500 words)',
        'Research Proposal (for PhD/research applicants)',
        'Three Academic Reference Letters',
        'Official Academic Transcripts and Degree Proof',
        'Curriculum Vitae (CV)',
      ]),
      applicationProcess: 'Apply for admission to a postgraduate degree and Gates Cambridge Scholarship simultaneously via the University of Cambridge Graduate Applicant Portal.',
      deadline: new Date('2026-12-03'),
      officialUrl: 'https://www.gatescambridge.org/',
      sourceUrl: 'https://www.cam.ac.uk',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isDemo: true,
    },
    {
      title: 'MEXT Japanese Government Research Student Scholarship',
      provider: 'Ministry of Education, Culture, Sports, Science and Technology (MEXT)',
      university: 'National & Public Universities in Japan (University of Tokyo, Kyoto, Tokyo Tech)',
      organization: 'Government of Japan',
      hostCountry: 'Japan',
      degreeLevels: JSON.stringify(['MASTERS', 'PHD']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Robotics', 'Electrical Engineering', 'Data Science', 'Artificial Intelligence']),
      fundingType: 'FULL_FUNDING',
      tuitionCoverage: '100% Exemption of Entrance Examination, Matriculation, and Tuition Fees',
      stipendAmount: '144,000 JPY/month (Masters) | 145,000 JPY/month (PhD candidates)',
      travelAllowance: true,
      accommodationCoverage: true,
      accommodationDetails: 'Round-trip international flight ticket between home country and Tokyo/Osaka provided.',
      minGpa: 3.2,
      maxGpaScale: 4.0,
      gpaRequirements: 'Minimum GPA of 3.2/4.0 in relevant undergraduate/graduate STEM coursework.',
      eligibleNationalities: JSON.stringify([]),
      nationalityRequirements: 'Citizens of countries that have diplomatic relations with Japan.',
      languageRequirements: JSON.stringify({ IELTS: 6.5, TOEFL: 85 }),
      eligibilityDescription: 'Applicants must be under 35 years of age and willing to study Japanese language during the preparatory 6-month period.',
      requiredDocuments: JSON.stringify([
        'MEXT Prescribed Application Form',
        'Field of Study and Research Plan (Research Proposal)',
        'Attested Academic Transcripts for all years attended',
        'Graduation Certificate / Degree Diploma',
        'Recommendation Letter from Dean or Academic Advisor',
        'Certificate of Health from approved medical practitioner',
        'Language Proficiency Certificate (English or Japanese JLPT)',
      ]),
      applicationProcess: 'Apply either through the Embassy Recommendation track (via Japanese Embassy in your country) or University Recommendation track.',
      deadline: new Date('2026-08-31'),
      officialUrl: 'https://www.studyinjapan.go.jp/en/planning/scholarship/',
      sourceUrl: 'https://www.mext.go.jp',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isDemo: true,
    },
    {
      title: 'SINGA Singapore International Graduate Award',
      provider: 'Agency for Science, Technology and Research (A*STAR)',
      university: 'A*STAR Research Institutes, NTU, NUS & SUTD',
      organization: 'Government of Singapore',
      hostCountry: 'Singapore',
      degreeLevels: JSON.stringify(['PHD']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Biomedical Sciences', 'Engineering', 'Artificial Intelligence', 'Cybersecurity']),
      fundingType: 'FULL_FUNDING',
      tuitionCoverage: '100% Full Tuition Fee Coverage for 4 years of PhD studies',
      stipendAmount: 'SGD $2,700 - $3,200 per month living stipend (increases upon qualifying exam)',
      travelAllowance: true,
      accommodationCoverage: true,
      accommodationDetails: 'One-time airfare grant of SGD $1,500 plus one-time settling-in allowance of SGD $1,000.',
      minGpa: 3.4,
      maxGpaScale: 4.0,
      gpaRequirements: 'Minimum GPA of 3.4/4.0 or Upper Second Class / First Class honours.',
      eligibleNationalities: JSON.stringify([]),
      nationalityRequirements: 'Open to all international graduates with passion for biomedical, physical sciences, and engineering research.',
      languageRequirements: JSON.stringify({ IELTS: 6.5, TOEFL: 90 }),
      eligibilityDescription: 'Candidates must possess excellent academic records, strong interest in advanced research, and exceptional English communication skills.',
      requiredDocuments: JSON.stringify([
        'Online SINGA Application Submission',
        'Official Bachelor and Master Academic Transcripts',
        'Two Academic Referee Reports submitted directly online',
        'Research Proposal and Statement of Research Interests',
        'Valid Passport Copy',
        'Recent Passport-sized Photograph',
      ]),
      applicationProcess: 'Apply online through the A*STAR SINGA portal. Select supervisor and research project from NTU, NUS, or SUTD rosters.',
      deadline: new Date('2026-12-01'),
      officialUrl: 'https://www.a-star.edu.sg/Scholarships',
      sourceUrl: 'https://www.a-star.edu.sg',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isDemo: true,
    },
    {
      title: 'KAIST International Graduate Excellence Fellowship',
      provider: 'Korea Advanced Institute of Science and Technology (KAIST)',
      university: 'KAIST Main Campus Daejeon',
      organization: 'KAIST Office of International Affairs',
      hostCountry: 'South Korea',
      degreeLevels: JSON.stringify(['BACHELORS', 'MASTERS', 'PHD']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Electrical Engineering', 'Artificial Intelligence', 'Robotics', 'Materials Science']),
      fundingType: 'FULL_FUNDING',
      tuitionCoverage: '100% Full Tuition Fee Waiver for full degree duration',
      stipendAmount: '350,000 KRW/month (Masters) | 400,000 KRW/month (PhD) + Research Project Assistantships',
      travelAllowance: false,
      accommodationCoverage: true,
      accommodationDetails: 'Guaranteed on-campus dormitory housing and National Health Insurance premium subsidy.',
      minGpa: 3.3,
      maxGpaScale: 4.0,
      gpaRequirements: 'Minimum GPA of 3.3/4.0 or equivalent 85%+ cumulative standing.',
      eligibleNationalities: JSON.stringify([]),
      nationalityRequirements: 'Applicants must hold foreign citizenship (neither applicant nor parents can be Korean citizens).',
      languageRequirements: JSON.stringify({ IELTS: 6.5, TOEFL: 83 }),
      eligibilityDescription: 'High academic distinction in mathematical and technical domains; strong coding skills in C/C++/Python for computing tracks.',
      requiredDocuments: JSON.stringify([
        'KAIST Online Application Form',
        'Official Academic Transcripts from all attended universities',
        'Two Letters of Recommendation from academic professors',
        'Statement of Financial Resources (Select KAIST Scholarship)',
        'English Proficiency Score (IELTS / TOEFL)',
        'Curriculum Vitae and Honors/Awards Certificates',
      ]),
      applicationProcess: 'Check "KAIST Scholarship" checkbox during standard online application submission on the KAIST admissions portal.',
      deadline: new Date('2026-09-25'),
      officialUrl: 'https://admission.kaist.ac.kr/international/',
      sourceUrl: 'https://kaist.ac.kr',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isDemo: true,
    },
    {
      title: 'Swiss Government Excellence Postgraduate Scholarships',
      provider: 'Federal Commission for Scholarships for Foreign Students (FCS)',
      university: 'ETH Zurich, EPFL, University of Zurich, University of Geneva',
      organization: 'State Secretariat for Education, Research and Innovation (SERI)',
      hostCountry: 'Switzerland',
      degreeLevels: JSON.stringify(['PHD', 'POSTDOC']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Artificial Intelligence', 'Physics', 'Robotics', 'Engineering']),
      fundingType: 'FULL_FUNDING',
      tuitionCoverage: '100% Tuition Exemption at all Swiss cantonal and federal universities',
      stipendAmount: 'CHF 1,920 per month (approx. $2,100/mo tax-free scholarship)',
      travelAllowance: true,
      accommodationCoverage: true,
      accommodationDetails: 'Mandatory Swiss health insurance coverage paid directly by FCS, plus CHF 300 one-time housing allowance.',
      minGpa: 3.6,
      maxGpaScale: 4.0,
      gpaRequirements: 'Outstanding Master degree with GPA 3.6+ / 4.0 (First Class honours).',
      eligibleNationalities: JSON.stringify([]),
      nationalityRequirements: 'Citizens of over 180 countries partnered with Swiss confederation.',
      languageRequirements: JSON.stringify({ IELTS: 7.0, TOEFL: 100 }),
      eligibilityDescription: 'Requires a prior written confirmation letter from an accredited Swiss university professor agreeing to supervise your PhD or research fellowship.',
      requiredDocuments: JSON.stringify([
        'FCS Official Application Form with Photo',
        'Full Curriculum Vitae with List of Academic Publications',
        'Letter of Motivation (Max 2 pages)',
        'Complete Research Proposal (Max 5 pages) using FCS standard template',
        'Letter of Support / Acceptance from Host Professor in Switzerland',
        'Two Confidential Letters of Recommendation',
        'Attested Diplomas and Transcripts',
      ]),
      applicationProcess: 'Obtain written commitment from an ETH/EPFL/Swiss host professor, then submit dossier to Swiss Embassy in your home country.',
      deadline: new Date('2026-11-15'),
      officialUrl: 'https://www.sbfi.admin.ch/scholarships_eng',
      sourceUrl: 'https://www.sbfi.admin.ch',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isDemo: true,
    },
    {
      title: 'Swedish Institute Scholarships for Global Professionals (SISGP)',
      provider: 'Swedish Institute (SI)',
      university: 'KTH Royal Institute of Technology, Chalmers, Lund & Uppsala University',
      organization: 'Ministry for Foreign Affairs of Sweden',
      hostCountry: 'Sweden',
      degreeLevels: JSON.stringify(['MASTERS']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Sustainable Energy', 'Software Engineering', 'Public Health', 'Data Analytics']),
      fundingType: 'FULL_FUNDING',
      tuitionCoverage: 'Full tuition fees paid directly to Swedish host university',
      stipendAmount: 'SEK 12,000 per month living stipend throughout master studies',
      travelAllowance: true,
      accommodationCoverage: true,
      accommodationDetails: 'Travel grant of SEK 15,000 (one-time) and comprehensive health/accident insurance.',
      minGpa: 3.1,
      maxGpaScale: 4.0,
      gpaRequirements: 'Minimum GPA of 3.1/4.0 in related undergraduate degree.',
      eligibleNationalities: JSON.stringify([]),
      nationalityRequirements: 'Citizens of 41 eligible developing/emerging partner nations.',
      languageRequirements: JSON.stringify({ IELTS: 6.5, TOEFL: 90 }),
      eligibilityDescription: 'Must possess at least 3,000 hours of documented work experience and demonstrated leadership experience in community/workplace.',
      requiredDocuments: JSON.stringify([
        'SI Curriculum Vitae on standard template',
        'Proof of Work and Leadership Experience Form',
        'Two Reference Letters (one must be based on work experience)',
        'Copy of Valid Passport',
        'Universityadmissions.se Master Program Application Confirmation',
      ]),
      applicationProcess: '1. Apply for eligible master programs via universityadmissions.se. 2. Submit SI scholarship application on SI portal during February call.',
      deadline: new Date('2026-10-30'),
      officialUrl: 'https://si.se/en/apply/scholarships/swedish-institute-scholarships-for-global-professionals/',
      sourceUrl: 'https://si.se',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isDemo: true,
    },
    {
      title: 'Australian Government Research Training Program (RTP) Scholarship',
      provider: 'Australian Department of Education',
      university: 'Group of Eight Universities (Univ of Melbourne, Sydney, UNSW, ANU, UQ)',
      organization: 'Commonwealth of Australia',
      hostCountry: 'Australia',
      degreeLevels: JSON.stringify(['MASTERS', 'PHD']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Cybersecurity', 'Biomedical Engineering', 'Renewable Energy', 'Artificial Intelligence']),
      fundingType: 'FULL_FUNDING',
      tuitionCoverage: '100% Tuition Fee Offset for up to 3.5 years (PhD) or 2 years (Research Masters)',
      stipendAmount: 'AUD $34,000 - $37,500 per annum tax-free living allowance',
      travelAllowance: true,
      accommodationCoverage: true,
      accommodationDetails: 'Relocation allowance up to AUD $2,000 and Overseas Student Health Cover (OSHC) single policy.',
      minGpa: 3.5,
      maxGpaScale: 4.0,
      gpaRequirements: 'High academic achievement with First Class Honours or equivalent research track record.',
      eligibleNationalities: JSON.stringify([]),
      nationalityRequirements: 'Open to domestic Australian and all international candidates.',
      languageRequirements: JSON.stringify({ IELTS: 7.0, TOEFL: 94 }),
      eligibilityDescription: 'Applicants must show strong research publication capacity or exceptional undergraduate research honours thesis.',
      requiredDocuments: JSON.stringify([
        'University Graduate Research Admissions & RTP Scholarship Application',
        'Comprehensive Academic Transcripts with Grading Keys',
        'Detailed Research Proposal (3–5 pages)',
        'Curriculum Vitae highlighting publications and code repositories',
        'Two Academic Referee Reports',
        'Proof of English Language Proficiency',
      ]),
      applicationProcess: 'Apply directly through the target Australian university graduate research school portal, ticking RTP scholarship consideration.',
      deadline: new Date('2026-09-15'),
      officialUrl: 'https://www.education.gov.au/research-block-grants/research-training-program',
      sourceUrl: 'https://www.education.gov.au',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isDemo: true,
    },
    {
      title: 'Eiffel Excellence Scholarship Programme',
      provider: 'French Ministry for Europe and Foreign Affairs (MEAE)',
      university: 'French Higher Education Institutions (École Polytechnique, Sorbonne, PSL)',
      organization: 'Campus France',
      hostCountry: 'France',
      degreeLevels: JSON.stringify(['MASTERS', 'PHD']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Applied Mathematics', 'Engineering Sciences', 'Economics']),
      fundingType: 'FULL_FUNDING',
      tuitionCoverage: 'Tuition support plus institutional fee exemption',
      stipendAmount: '€1,181/month (Masters) | €1,800/month (PhD candidates)',
      travelAllowance: true,
      accommodationCoverage: true,
      accommodationDetails: 'Direct housing assistance, international return airfare, cultural activities, and Campus France health coverage.',
      minGpa: 3.4,
      maxGpaScale: 4.0,
      gpaRequirements: 'Minimum GPA of 3.4/4.0 (Top 10% class rank).',
      eligibleNationalities: JSON.stringify([]),
      nationalityRequirements: 'Open to foreign candidates (French dual nationals ineligible). Age limit: 25 for Master, 30 for PhD.',
      languageRequirements: JSON.stringify({ IELTS: 6.5, TOEFL: 88 }),
      eligibilityDescription: 'Designed for elite international students nominated directly by French universities to study high-priority engineering and science courses.',
      requiredDocuments: JSON.stringify([
        'Campus France Eiffel Application Package',
        'Complete Transcripts of Higher Education',
        'Curriculum Vitae in French or English',
        'Professional Project Motivation Statement (1–2 pages)',
        'Letters of Recommendation from Home and French University Professors',
        'Language Proficiency Certificate (English or French B2/C1)',
      ]),
      applicationProcess: 'Contact the international admissions office of your target French university; the French institution evaluates and nominates you directly to Campus France.',
      deadline: new Date('2026-11-20'),
      officialUrl: 'https://www.campusfrance.org/en/eiffel-scholarship-program-of-excellence',
      sourceUrl: 'https://www.campusfrance.org',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isDemo: true,
    }
  ];

  for (const s of scholarshipsData) {
    const created = await prisma.scholarship.create({ data: s });
    console.log(`🎓 Seeded Scholarship: ${created.title}`);

    await prisma.scholarshipSource.create({
      data: {
        scholarshipId: created.id,
        sourceName: 'Official Institutional Portal Ingestion',
        rawPayload: JSON.stringify({ initialUrl: s.officialUrl, verificationDate: new Date() }),
      },
    });

    await prisma.scholarshipVerification.create({
      data: {
        scholarshipId: created.id,
        status: 'VERIFIED',
        notes: 'Verified against official institutional requirements and verified deadline.',
      },
    });

    const isMatched = s.fieldsOfStudy.includes('Computer Science') || s.fieldsOfStudy.includes('Artificial Intelligence');
    const reasons = [
      `Degree level (${demoUser.profile!.targetDegreeLevel}) aligns with scholarship offering`,
      `Field of study (${demoUser.profile!.fieldOfStudy}) directly satisfies requirements`,
      `Student GPA (${demoUser.profile!.gpa}/4.0) satisfies or exceeds minimum benchmark (${s.minGpa})`,
      `IELTS score (7.5) meets language criteria`,
      `Host country (${s.hostCountry}) matches student destination preferences`,
    ];
    const steps = [
      'Prepare Statement of Purpose tailored to ' + s.title,
      'Gather certified transcripts and 2 academic recommendation letters',
      'Add scholarship to Application Tracker checklist',
    ];

    await prisma.scholarshipMatch.create({
      data: {
        profileId: demoUser.profile!.id,
        scholarshipId: created.id,
        matchPercentage: isMatched ? (s.hostCountry === 'Germany' ? 96 : s.hostCountry === 'United Kingdom' ? 92 : 88) : 74,
        eligibility: isMatched ? 'ELIGIBLE' : 'POTENTIALLY_ELIGIBLE',
        matchingCriteria: JSON.stringify(reasons),
        missingCriteria: JSON.stringify([]),
        uncertainCriteria: JSON.stringify([]),
        recommendations: JSON.stringify(steps),
        matchReasons: JSON.stringify(reasons),
        missingReqs: JSON.stringify([]),
        concerns: JSON.stringify([]),
        nextSteps: JSON.stringify(steps),
      },
    });
  }

  // Top demo saved & applied scholarship
  const topScholarship = await prisma.scholarship.findFirst({
    where: { title: { contains: 'Erasmus Mundus' } },
  });

  if (topScholarship) {
    await prisma.savedScholarship.create({
      data: {
        userId: demoUser.id,
        scholarshipId: topScholarship.id,
      },
    });

    await prisma.application.create({
      data: {
        userId: demoUser.id,
        scholarshipId: topScholarship.id,
        status: 'PREPARING',
        notes: 'Targeting next intake. Transcripts uploaded, working on Europass CV and Statement of Purpose draft.',
        checklists: {
          create: [
            { item: 'Order official university transcripts and degree certificate', isCompleted: true },
            { item: 'Draft Europass format CV with research experience', isCompleted: true },
            { item: 'Write Statement of Purpose (SOP) with AI Copilot assistance', isCompleted: false },
            { item: 'Contact Prof. Smith & Prof. Ahmed for Recommendation Letters', isCompleted: false },
            { item: 'Submit completed dossier via consortium portal', isCompleted: false },
          ],
        },
      },
    });
  }

  // Second demo saved scholarship
  const daadScholarship = await prisma.scholarship.findFirst({
    where: { title: { contains: 'DAAD EPOS' } },
  });

  if (daadScholarship) {
    await prisma.savedScholarship.create({
      data: {
        userId: demoUser.id,
        scholarshipId: daadScholarship.id,
      },
    });
  }

  await prisma.notification.create({
    data: {
      userId: demoUser.id,
      title: 'Welcome to AI Scholarship Copilot',
      message: `Your student profile is active. We analyzed your background and found 12 high-match verified scholarships!`,
      type: 'NEW_MATCH',
      isRead: false,
      link: '/scholarships',
    },
  });

  console.log('✅ Database seeded successfully with 12 verified demo scholarships!');
}

main()
  .catch((e: any) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
