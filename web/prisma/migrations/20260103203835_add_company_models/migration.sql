-- CreateEnum
CREATE TYPE "TranscriptionSource" AS ENUM ('UPLOAD', 'RECORDING');

-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "company" TEXT;

-- CreateTable
CREATE TABLE "Transcription" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "title" TEXT,
    "source" "TranscriptionSource" NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transcription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nonGoals" TEXT,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "industry" TEXT,
    "foundedDate" TIMESTAMP(3),
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyNews" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceUrls" TEXT[],
    "rawData" TEXT,
    "companyId" TEXT NOT NULL,
    "researchDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyNews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyStrategy" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "embedding" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DocumentShares" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_tenantId_key" ON "Company"("tenantId");

-- CreateIndex
CREATE INDEX "CompanyNews_companyId_researchDate_idx" ON "CompanyNews"("companyId", "researchDate");

-- CreateIndex
CREATE INDEX "CompanyStrategy_companyId_isActive_idx" ON "CompanyStrategy"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "_DocumentShares_AB_unique" ON "_DocumentShares"("A", "B");

-- CreateIndex
CREATE INDEX "_DocumentShares_B_index" ON "_DocumentShares"("B");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcription" ADD CONSTRAINT "Transcription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyNews" ADD CONSTRAINT "CompanyNews_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyStrategy" ADD CONSTRAINT "CompanyStrategy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocumentShares" ADD CONSTRAINT "_DocumentShares_A_fkey" FOREIGN KEY ("A") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocumentShares" ADD CONSTRAINT "_DocumentShares_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
