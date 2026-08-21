-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "Notification" ADD COLUMN "dispatchedAt" DATETIME;

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowKey" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'SCHEDULE',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "durationMs" INTEGER,
    "metrics" TEXT,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "triggeredBy" TEXT,
    "lockKey" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_lockKey_key" ON "WorkflowRun"("lockKey");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowKey_startedAt_idx" ON "WorkflowRun"("workflowKey", "startedAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_idx" ON "WorkflowRun"("status");

-- CreateIndex
CREATE INDEX "WorkflowRun_startedAt_idx" ON "WorkflowRun"("startedAt");

-- CreateIndex
CREATE INDEX "Application_scholarshipId_idx" ON "Application"("scholarshipId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Application_userId_updatedAt_idx" ON "Application"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ApplicationChecklist_applicationId_idx" ON "ApplicationChecklist"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationChecklist_isCompleted_idx" ON "ApplicationChecklist"("isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationChecklist_applicationId_item_key" ON "ApplicationChecklist"("applicationId", "item");

-- CreateIndex
CREATE INDEX "CVAnalysis_userId_createdAt_idx" ON "CVAnalysis"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatConversation_userId_createdAt_idx" ON "ChatConversation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_isRead_dispatchedAt_idx" ON "Notification"("isRead", "dispatchedAt");

-- CreateIndex
CREATE INDEX "Reminder_userId_idx" ON "Reminder"("userId");

-- CreateIndex
CREATE INDEX "Reminder_isSent_dueDate_idx" ON "Reminder"("isSent", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_userId_title_dueDate_key" ON "Reminder"("userId", "title", "dueDate");

-- CreateIndex
CREATE INDEX "SOPSession_userId_updatedAt_idx" ON "SOPSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "SavedScholarship_scholarshipId_idx" ON "SavedScholarship"("scholarshipId");

-- CreateIndex
CREATE INDEX "SavedScholarship_userId_createdAt_idx" ON "SavedScholarship"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Scholarship_officialUrl_idx" ON "Scholarship"("officialUrl");

-- CreateIndex
CREATE INDEX "Scholarship_sourceUrl_idx" ON "Scholarship"("sourceUrl");

-- CreateIndex
CREATE INDEX "Scholarship_lastVerifiedAt_idx" ON "Scholarship"("lastVerifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Scholarship_title_provider_key" ON "Scholarship"("title", "provider");

-- CreateIndex
CREATE INDEX "ScholarshipMatch_scholarshipId_idx" ON "ScholarshipMatch"("scholarshipId");

-- CreateIndex
CREATE INDEX "ScholarshipMatch_matchPercentage_idx" ON "ScholarshipMatch"("matchPercentage");

-- CreateIndex
CREATE INDEX "ScholarshipMatch_eligibility_idx" ON "ScholarshipMatch"("eligibility");

-- CreateIndex
CREATE INDEX "ScholarshipMatch_calculatedAt_idx" ON "ScholarshipMatch"("calculatedAt");

-- CreateIndex
CREATE INDEX "ScholarshipSource_scholarshipId_idx" ON "ScholarshipSource"("scholarshipId");

-- CreateIndex
CREATE INDEX "ScholarshipSource_fetchedAt_idx" ON "ScholarshipSource"("fetchedAt");

-- CreateIndex
CREATE INDEX "ScholarshipVerification_scholarshipId_idx" ON "ScholarshipVerification"("scholarshipId");

-- CreateIndex
CREATE INDEX "ScholarshipVerification_status_idx" ON "ScholarshipVerification"("status");

-- CreateIndex
CREATE INDEX "ScholarshipVerification_verifiedAt_idx" ON "ScholarshipVerification"("verifiedAt");

-- CreateIndex
CREATE INDEX "StudentProfile_targetDegreeLevel_idx" ON "StudentProfile"("targetDegreeLevel");

-- CreateIndex
CREATE INDEX "StudentProfile_fieldOfStudy_idx" ON "StudentProfile"("fieldOfStudy");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

