-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "contacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "contractText" TEXT,
ADD COLUMN     "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "postedBy" TEXT,
ADD COLUMN     "posterProfileUrl" TEXT;
