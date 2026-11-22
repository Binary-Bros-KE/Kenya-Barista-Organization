-- Profile photos and job cover photos are stored in Cloudinary; only the image version is kept here.
ALTER TABLE "User" ADD COLUMN "avatarVersion" INTEGER;
ALTER TABLE "Job" ADD COLUMN "coverVersion" INTEGER;

-- Richer profiles: headline, experience, skills, availability, links and a card colour.
ALTER TABLE "ApplicantProfile"
  ADD COLUMN "headline" TEXT,
  ADD COLUMN "experienceYears" INTEGER,
  ADD COLUMN "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "openToWork" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "instagram" TEXT,
  ADD COLUMN "linkedin" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "accent" TEXT NOT NULL DEFAULT 'espresso';
