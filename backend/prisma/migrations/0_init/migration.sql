-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INTERESTED',
    "notes" TEXT,
    "submissionDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" DATETIME,
    FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CVAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cvText" TEXT NOT NULL,
    "skillsFound" TEXT NOT NULL DEFAULT '[]',
    "strengths" TEXT NOT NULL DEFAULT '[]',
    "weaknesses" TEXT NOT NULL DEFAULT '[]',
    "suggestions" TEXT NOT NULL DEFAULT '[]',
    "score" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" TEXT,
    "toolResults" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("conversationId") REFERENCES "ChatConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SOPSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "targetScholarship" TEXT,
    "draftText" TEXT NOT NULL,
    "feedback" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedScholarship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scholarship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "university" TEXT,
    "organization" TEXT,
    "hostCountry" TEXT NOT NULL,
    "degreeLevels" TEXT NOT NULL DEFAULT '["MASTERS"]',
    "fieldsOfStudy" TEXT NOT NULL DEFAULT '["Computer Science"]',
    "fundingType" TEXT NOT NULL DEFAULT 'FULL_FUNDING',
    "tuitionCoverage" TEXT,
    "stipendAmount" TEXT,
    "travelAllowance" BOOLEAN NOT NULL DEFAULT false,
    "accommodationCoverage" BOOLEAN NOT NULL DEFAULT false,
    "accommodationDetails" TEXT,
    "minGpa" REAL,
    "maxGpaScale" REAL NOT NULL DEFAULT 4.0,
    "gpaRequirements" TEXT,
    "eligibleNationalities" TEXT NOT NULL DEFAULT '[]',
    "nationalityRequirements" TEXT,
    "languageRequirements" TEXT NOT NULL DEFAULT '{}',
    "eligibilityDescription" TEXT,
    "requiredDocuments" TEXT NOT NULL DEFAULT '[]',
    "applicationProcess" TEXT NOT NULL,
    "deadline" DATETIME,
    "officialUrl" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "verificationConfidence" REAL NOT NULL DEFAULT 1.0,
    "verificationReport" TEXT,
    "lastVerifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScholarshipMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "matchPercentage" REAL NOT NULL,
    "eligibility" TEXT NOT NULL,
    "matchingCriteria" TEXT NOT NULL DEFAULT '[]',
    "missingCriteria" TEXT NOT NULL DEFAULT '[]',
    "uncertainCriteria" TEXT NOT NULL DEFAULT '[]',
    "warnings" TEXT NOT NULL DEFAULT '[]',
    "recommendations" TEXT NOT NULL DEFAULT '[]',
    "breakdown" TEXT NOT NULL DEFAULT '{}',
    "matchReasons" TEXT NOT NULL DEFAULT '[]',
    "missingReqs" TEXT NOT NULL DEFAULT '[]',
    "concerns" TEXT NOT NULL DEFAULT '[]',
    "nextSteps" TEXT NOT NULL DEFAULT '[]',
    "profileHash" TEXT,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("profileId") REFERENCES "StudentProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScholarshipSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scholarshipId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "rawPayload" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScholarshipVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scholarshipId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "overallConfidence" REAL NOT NULL DEFAULT 1.0,
    "verifiedBy" TEXT NOT NULL DEFAULT 'AI_VERIFICATION_AGENT',
    "fieldAudits" TEXT,
    "deadlineValid" BOOLEAN NOT NULL DEFAULT true,
    "urlReachable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "verifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "countryOfResidence" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "currentDegreeLevel" TEXT NOT NULL,
    "currentDegreeName" TEXT NOT NULL,
    "fieldOfStudy" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "gpa" REAL NOT NULL,
    "maxGpa" REAL NOT NULL DEFAULT 4.0,
    "graduationYear" INTEGER NOT NULL,
    "targetDegreeLevel" TEXT NOT NULL,
    "targetCountries" TEXT NOT NULL DEFAULT '[]',
    "preferredFields" TEXT NOT NULL DEFAULT '[]',
    "languageTests" TEXT NOT NULL DEFAULT '{}',
    "financialPreference" TEXT,
    "scholarshipPreference" TEXT,
    "skills" TEXT NOT NULL DEFAULT '[]',
    "workExperienceYears" REAL NOT NULL DEFAULT 0,
    "researchExperience" TEXT,
    "cvUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_userId_scholarshipId_key" ON "Application"("userId" ASC, "scholarshipId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SavedScholarship_userId_scholarshipId_key" ON "SavedScholarship"("userId" ASC, "scholarshipId" ASC);

-- CreateIndex
CREATE INDEX "Scholarship_provider_idx" ON "Scholarship"("provider" ASC);

-- CreateIndex
CREATE INDEX "Scholarship_title_idx" ON "Scholarship"("title" ASC);

-- CreateIndex
CREATE INDEX "Scholarship_createdAt_idx" ON "Scholarship"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "Scholarship_isDemo_idx" ON "Scholarship"("isDemo" ASC);

-- CreateIndex
CREATE INDEX "Scholarship_deadline_idx" ON "Scholarship"("deadline" ASC);

-- CreateIndex
CREATE INDEX "Scholarship_verificationStatus_idx" ON "Scholarship"("verificationStatus" ASC);

-- CreateIndex
CREATE INDEX "Scholarship_fundingType_idx" ON "Scholarship"("fundingType" ASC);

-- CreateIndex
CREATE INDEX "Scholarship_hostCountry_idx" ON "Scholarship"("hostCountry" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ScholarshipMatch_profileId_scholarshipId_key" ON "ScholarshipMatch"("profileId" ASC, "scholarshipId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email" ASC);
