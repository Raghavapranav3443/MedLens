-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fact" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "sourceDocId" TEXT,
    "kind" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "canonicalName" TEXT,
    "value" TEXT,
    "unit" TEXT,
    "rangeText" TEXT,
    "rangeLow" DOUBLE PRECISION,
    "rangeHigh" DOUBLE PRECISION,
    "status" TEXT,
    "evidenceStart" INTEGER,
    "evidenceEnd" INTEGER,
    "origin" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "review" TEXT NOT NULL DEFAULT 'unreviewed',
    "confidence" DOUBLE PRECISION,
    "corrections" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,

    CONSTRAINT "Fact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "before" TEXT,
    "after" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "note" TEXT,
    "planValid" BOOLEAN NOT NULL,
    "aiAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionCache" (
    "key" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RateLimitCounter" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Record_sessionId_createdAt_idx" ON "Record"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SourceDocument_recordId_createdAt_idx" ON "SourceDocument"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "Fact_recordId_kind_idx" ON "Fact"("recordId", "kind");

-- CreateIndex
CREATE INDEX "AuditEvent_recordId_createdAt_idx" ON "AuditEvent"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "Summary_recordId_createdAt_idx" ON "Summary"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimitCounter_sessionId_route_idx" ON "RateLimitCounter"("sessionId", "route");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitCounter_sessionId_route_windowStart_key" ON "RateLimitCounter"("sessionId", "route", "windowStart");

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;


c:\Users\Rupesh\Desktop\Projects\Medlens>