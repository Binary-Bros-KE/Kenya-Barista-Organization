import test from "node:test";
import assert from "node:assert/strict";
import { applicationSubmittedEmail, jobPublishedEmail, jobSubmittedEmail, newApplicantEmail } from "../src/server/email-templates";

test("job and application emails are branded, link back to KBO and escape what people typed", () => {
  const base = "https://kbo.example", job = { baseUrl: base, name: "Achieng Odhiambo", jobTitle: "Head <b>Barista</b>", location: "Nairobi & Kiambu", deadline: "30 Nov 2026, 17:00", href: "/employer/jobs/job-1" };
  const submitted = jobSubmittedEmail(job);
  assert.equal(submitted.subject, 'Your job "Head <b>Barista</b>" is in review');
  assert.ok(submitted.html.includes("Hi Achieng,")); assert.ok(submitted.html.includes("Head &lt;b&gt;Barista&lt;/b&gt;")); assert.ok(!submitted.html.includes("<b>Barista"));
  assert.ok(submitted.html.includes('href="https://kbo.example/employer/jobs/job-1"')); assert.ok(submitted.text.includes("Applications close: 30 Nov 2026, 17:00"));
  const published = jobPublishedEmail({ ...job, publicHref: "/jobs/head-barista-1" });
  assert.ok(published.subject.includes("is now live")); assert.ok(published.html.includes("https://kbo.example/jobs/head-barista-1")); assert.ok(published.text.includes("Public link: https://kbo.example/jobs/head-barista-1"));
  const applied = applicationSubmittedEmail({ baseUrl: base, name: "Brian", jobTitle: "Head Barista", employer: "Java <House>", location: "Nairobi", submittedAt: "23 Nov 2026, 10:00", href: "/dashboard/applications/app-1" });
  assert.equal(applied.subject, "Application received: Head Barista"); assert.ok(applied.html.includes("Java &lt;House&gt;"));
  assert.ok(applied.html.includes('href="https://kbo.example/dashboard/applications/app-1"')); assert.ok(applied.text.includes("Recruiter: Java <House>"));
  const applicant = newApplicantEmail({ baseUrl: base, name: null, jobTitle: "Head Barista", applicant: "Brian <Otieno>", applicants: 4, href: "/employer/applications/app-1" });
  assert.equal(applicant.subject, "Brian <Otieno> applied for Head Barista"); assert.ok(applicant.html.includes("Hi there,")); assert.ok(applicant.html.includes("Brian &lt;Otieno&gt;")); assert.ok(applicant.text.includes("Applicants so far: 4"));
  assert.ok(applicant.html.includes('href="https://kbo.example/employer/applications/app-1"'));
});
