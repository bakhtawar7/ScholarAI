export type Role = 'STUDENT' | 'ADMIN';

export type DegreeLevel = 'HIGH_SCHOOL' | 'BACHELORS' | 'MASTERS' | 'PHD' | 'POSTDOC' | 'SHORT_COURSE';

export type FundingType = 'FULL_FUNDING' | 'PARTIAL_FUNDING' | 'TUITION_ONLY' | 'STIPEND_ONLY' | 'TRAVEL_GRANT';

export type VerificationStatus = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED' | 'PENDING_VERIFICATION' | 'UNVERIFIED' | 'DEPRECATED';

export type ApplicationStatus = 'INTERESTED' | 'PREPARING' | 'READY_TO_APPLY' | 'APPLIED' | 'INTERVIEW' | 'ACCEPTED' | 'REJECTED';

export interface FieldAudit {
  field: string;
  value: any;
  source: string;
  confidence: number;
  status: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED';
  lastVerifiedDate: string;
  notes: string;
}

export interface VerificationReport {
  scholarshipId: string;
  title: string;
  status: VerificationStatus;
  overallConfidence: number;
  deadlineValid: boolean;
  urlReachable: boolean;
  fieldAudits: FieldAudit[];
  summaryNotes: string;
  verifiedAt: string;
  verifiedBy: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  fullName: string;
  countryOfResidence: string;
  nationality: string;
  currentDegreeLevel: DegreeLevel;
  currentDegreeName: string;
  fieldOfStudy: string;
  university: string;
  gpa: number;
  maxGpa: number;
  graduationYear: number;
  targetDegreeLevel: DegreeLevel;
  targetCountries: string[];
  preferredFields: string[];
  languageTests?: Record<string, any>;
  financialPreference?: string;
  scholarshipPreference?: string;
  skills: string[];
  workExperienceYears: number;
  researchExperience?: string;
  cvUrl?: string;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  profile?: StudentProfile;
}

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

export interface ScholarshipMatch {
  id?: string;
  matchScore: number;
  matchPercentage?: number;
  eligibilityStatus: EligibilityStatus;
  eligibility?: EligibilityStatus | 'UNCLEAR';
  matchingCriteria: string[];
  missingCriteria: string[];
  uncertainCriteria: string[];
  warnings: string[];
  recommendations: string[];
  breakdown?: MatchingBreakdown;
  disclaimer?: string;
  isCached?: boolean;
  calculatedAt?: string;
  matchReasons?: string[];
  missingReqs?: string[];
  concerns?: string[];
  nextSteps?: string[];
}

export interface Scholarship {
  id: string;
  title: string;
  provider: string;
  university?: string;
  organization?: string;
  hostCountry: string;
  country?: string;
  degreeLevels: DegreeLevel[];
  fieldsOfStudy: string[];
  fields?: string[];
  fundingType: FundingType;
  tuitionCoverage?: string;
  stipendAmount?: string;
  stipend?: string;
  travelAllowance: boolean;
  accommodationCoverage: boolean;
  accommodation?: boolean;
  accommodationDetails?: string;
  minGpa?: number;
  maxGpaScale: number;
  gpaRequirements?: string;
  eligibleNationalities: string[];
  nationalityRequirements?: string;
  languageRequirements?: Record<string, any>;
  eligibilityDescription?: string;
  requiredDocuments: string[];
  applicationProcess: string;
  deadline?: string;
  officialUrl: string;
  officialApplicationUrl?: string;
  sourceUrl?: string;
  lastVerifiedAt: string;
  lastVerifiedDate?: string;
  verificationStatus: VerificationStatus;
  verificationConfidence?: number;
  verificationReport?: VerificationReport;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
  userMatch?: ScholarshipMatch;
  isSaved?: boolean;
  applicationStatus?: ApplicationStatus;
  verifications?: Array<{
    id: string;
    status: string;
    overallConfidence?: number;
    verifiedBy?: string;
    notes?: string;
    verifiedAt: string;
    fieldAudits?: FieldAudit[];
  }>;
  sources?: Array<{ id: string; sourceName: string; rawPayload?: string; fetchedAt: string }>;
}

export interface FilterOptionItem {
  value: string;
  count: number;
}

export interface ScholarshipFilterFacets {
  countries: FilterOptionItem[];
  fundingTypes: FilterOptionItem[];
  degreeLevels: FilterOptionItem[];
  fieldsOfStudy: FilterOptionItem[];
  verificationStatuses: FilterOptionItem[];
}

export interface ScholarshipSearchResult {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  items: Scholarship[];
  availableFilters?: ScholarshipFilterFacets;
}

export interface ApplicationChecklist {
  id: string;
  applicationId: string;
  item: string;
  isCompleted: boolean;
  dueDate?: string;
}

export interface Application {
  id: string;
  userId: string;
  scholarshipId: string;
  scholarship: Scholarship;
  status: ApplicationStatus;
  notes?: string;
  submissionDate?: string;
  checklists: ApplicationChecklist[];
  updatedAt: string;
}

export interface DeadlineItem {
  scholarship: Scholarship;
  status: string;
  isSaved: boolean;
  daysRemaining: number;
  urgency: 'CRITICAL' | 'URGENT' | 'UPCOMING' | 'EXPIRED';
  deadlineFormatted: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  toolCalls?: any[];
  createdAt: string;
}

// --- CV & SOP Types ---

export interface CVDimensionScores {
  education: number;
  skills: number;
  projects?: number;
  experience: number;
  achievements?: number;
  research: number;
  clarity: number;
  scholarshipRelevance: number;
}

export interface CVExtractedEntities {
  education: string[];
  skills: string[];
  projects?: string[];
  experience: string[];
  achievements?: string[];
  research?: string[];
}

export interface CVAnalysisResult {
  id?: string;
  userId?: string;
  score: number;
  dimensionScores: CVDimensionScores;
  extractedEntities: CVExtractedEntities;
  skillsFound?: string[];
  strengths: string[];
  weaknesses: string[];
  missingInformation: string[];
  suggestions: string[];
  scholarshipFitSummary: string;
  createdAt?: string;
}

export interface SOPSectionBreakdown {
  section: string;
  status: 'STRONG' | 'NEEDS_WORK' | 'MISSING';
  feedback: string;
  suggestion: string;
}

export interface SOPFeedbackResult {
  alignmentScore: number;
  structureRating: string;
  clarityScore: number;
  relevanceScore: number;
  grammarAndTone: string;
  keyStrengths: string[];
  areasForImprovement: string[];
  missingInformation: string[];
  sectionBreakdown: SOPSectionBreakdown[];
  suggestedOutline: string[];
  actionableNextSteps: string[];
}

export interface SOPQuestion {
  id: string;
  category: string;
  question: string;
  hint: string;
  placeholder?: string;
}

export interface SOPOutlineSection {
  paragraphNumber: number;
  sectionTitle: string;
  purpose: string;
  recommendedWordCount: string;
  userContent?: string;
  keyElements: string[];
}

export interface SOPSession {
  id: string;
  targetScholarship: string;
  draftText?: string;
  draftSnippet?: string;
  draftLength?: number;
  feedback?: SOPFeedbackResult | null;
  createdAt: string;
  updatedAt?: string;
}
