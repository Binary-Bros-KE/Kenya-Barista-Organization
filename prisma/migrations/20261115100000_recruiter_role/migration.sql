-- Recruiters become their own account type. Added in its own migration so later migrations can use the new value.
ALTER TYPE "PlatformRole" ADD VALUE 'RECRUITER';
