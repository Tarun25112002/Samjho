-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "guardianDeclaredAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedVersion" TEXT;
