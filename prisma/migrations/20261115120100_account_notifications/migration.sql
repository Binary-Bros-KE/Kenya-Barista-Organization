-- Personal account notices (e.g. recruiter request decisions) use the ACCOUNT audience.
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_audience_valid";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_audience_valid" CHECK ("audience" IN ('APPLICANT', 'EMPLOYER', 'ADMIN', 'ACCOUNT'));
