-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFTED', 'SURFACED', 'WITHHELD', 'ACCEPTED', 'EDITED', 'REJECTED', 'COMMITTED');

-- CreateEnum
CREATE TYPE "ValueSource" AS ENUM ('HUMAN', 'AGENT', 'IMPORTED');

-- CreateEnum
CREATE TYPE "AgentKind" AS ENUM ('SCRIBE', 'INTAKE', 'SUGGESTION', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "kind" "AgentKind" NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "transcriptId" TEXT,
    "documentId" TEXT,
    "startOffset" INTEGER,
    "endOffset" INTEGER,
    "pageNumber" INTEGER,
    "quote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "formInstanceId" TEXT NOT NULL,
    "questionCode" TEXT NOT NULL,
    "proposedValue" JSONB NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFTED',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "finalValue" JSONB,
    "editDistance" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_instances" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "visitId" TEXT,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "formCode" TEXT NOT NULL,
    "formVersion" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "signedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_values" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "formInstanceId" TEXT NOT NULL,
    "questionCode" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "source" "ValueSource" NOT NULL,
    "proposalId" TEXT,
    "enteredById" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_findings" (
    "id" TEXT NOT NULL,
    "formInstanceId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "questionCode" TEXT,
    "message" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_runs_agencyId_kind_idx" ON "agent_runs"("agencyId", "kind");

-- CreateIndex
CREATE INDEX "agent_runs_createdAt_idx" ON "agent_runs"("createdAt");

-- CreateIndex
CREATE INDEX "evidence_proposalId_idx" ON "evidence"("proposalId");

-- CreateIndex
CREATE INDEX "evidence_transcriptId_idx" ON "evidence"("transcriptId");

-- CreateIndex
CREATE INDEX "evidence_documentId_idx" ON "evidence"("documentId");

-- CreateIndex
CREATE INDEX "proposals_formInstanceId_status_idx" ON "proposals"("formInstanceId", "status");

-- CreateIndex
CREATE INDEX "proposals_agencyId_questionCode_idx" ON "proposals"("agencyId", "questionCode");

-- CreateIndex
CREATE INDEX "proposals_agentRunId_idx" ON "proposals"("agentRunId");

-- CreateIndex
CREATE INDEX "form_instances_agencyId_status_idx" ON "form_instances"("agencyId", "status");

-- CreateIndex
CREATE INDEX "form_instances_patientId_idx" ON "form_instances"("patientId");

-- CreateIndex
CREATE INDEX "form_instances_visitId_idx" ON "form_instances"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "field_values_proposalId_key" ON "field_values"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "field_values_supersedesId_key" ON "field_values"("supersedesId");

-- CreateIndex
CREATE INDEX "field_values_formInstanceId_idx" ON "field_values"("formInstanceId");

-- CreateIndex
CREATE INDEX "field_values_agencyId_questionCode_idx" ON "field_values"("agencyId", "questionCode");

-- CreateIndex
CREATE UNIQUE INDEX "field_values_formInstanceId_questionCode_supersedesId_key" ON "field_values"("formInstanceId", "questionCode", "supersedesId");

-- CreateIndex
CREATE INDEX "validation_findings_formInstanceId_severity_idx" ON "validation_findings"("formInstanceId", "severity");

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_formInstanceId_fkey" FOREIGN KEY ("formInstanceId") REFERENCES "form_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_formInstanceId_fkey" FOREIGN KEY ("formInstanceId") REFERENCES "form_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "field_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_findings" ADD CONSTRAINT "validation_findings_formInstanceId_fkey" FOREIGN KEY ("formInstanceId") REFERENCES "form_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
