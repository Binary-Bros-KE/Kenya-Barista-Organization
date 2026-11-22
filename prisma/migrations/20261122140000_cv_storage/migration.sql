-- CVs can live on the server's disk or as private files in Cloudinary. Existing CVs stay on disk.
ALTER TABLE "Document" ADD COLUMN "storage" TEXT NOT NULL DEFAULT 'disk';
ALTER TABLE "Document" ADD CONSTRAINT "Document_storage_valid" CHECK ("storage" IN ('disk', 'cloudinary'));
