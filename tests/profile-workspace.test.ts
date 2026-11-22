import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { CvManager, cvPresentation, validateCvSelection } from "../src/components/profile-workspace";
import { ProfileStudio } from "../src/components/profile-studio";
function render(component: React.ReactNode) { return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as any }, component)); }
test("CV selection accepts PDFs up to the boundary without relying on MIME and rejects empty, oversized and other files", () => {
 assert.equal(validateCvSelection({ name: "CV.PDF", size: 5 * 1024 * 1024 }), "");
 for (const file of [{ name: "cv.pdf", size: 0 }, { name: "cv.pdf", size: 5 * 1024 * 1024 + 1 }, { name: "cv.exe", size: 20 }]) assert.ok(validateCvSelection(file));
});
test("screening states never advertise rejected or unknown files as usable or downloadable", () => {
 assert.equal(cvPresentation("CLEAN").label, "Ready to apply");
 assert.equal(cvPresentation("PENDING").label, "Screening");
 assert.equal(cvPresentation("PENDING").downloadable, true);
 for (const status of ["REJECTED", "UNKNOWN"]) assert.equal(cvPresentation(status).downloadable, false);
});
test("My profile keeps the required contact details, Kenyan phone validation and an optional story", () => {
 const html = render(createElement(ProfileStudio, { userId: "u1", avatarVersion: null, imagesEnabled: false, cvCount: 0, initial: { fullName: "Coffee Professional", phone: "+254712345678", location: "Nairobi", summary: "", headline: "", experienceYears: null, skills: [], openToWork: true, instagram: "", linkedin: "", website: "", accent: "espresso" } }));
 assert.ok(html.includes('pattern="\\+254[17][0-9]{8}"'));
 assert.equal([...html.matchAll(/<input[^>]*required=""[^>]*>/g)].length, 3, "Name, mobile and location are required");
 assert.ok(!/<textarea[^>]*required/.test(html));
 assert.ok(html.includes('maxLength="3000"'));
 assert.ok(html.includes('autoComplete="tel"'));
 assert.ok(html.includes("Photo uploads are coming soon"), "Explains when uploads are switched off");
});
test("the CV panel hides blocked downloads, explains attached CVs and asks before deletion", () => {
 const html = render(createElement(CvManager, { documents: [
 { id: "clean", filename: "ready.pdf", scanStatus: "CLEAN", attachmentCount: 1 },
 { id: "pending", filename: "screening.pdf", scanStatus: "PENDING" },
 { id: "rejected", filename: "blocked.pdf", scanStatus: "REJECTED" },
 ] }));
 assert.ok(html.includes('href="/api/documents/clean"')); assert.ok(html.includes('href="/api/documents/pending"')); assert.ok(!html.includes('href="/api/documents/rejected"'));
 assert.ok(html.includes("applications you&#x27;ve sent keep this one"));
 assert.match(html, /class="profile-remove" disabled=""/);
 assert.ok(!html.includes('Yes, remove CV'));
 assert.ok(html.includes('Refresh status'));
 assert.equal((html.match(/class="cv-view-button is-light"/g) || []).length, 2, "Readable CVs can be viewed in the page; blocked ones can't");
});
test("one CV: an empty panel invites an upload, and an existing CV offers to replace it", () => {
 const empty = render(createElement(CvManager, { documents: [] }));
 assert.ok(empty.includes('Your next chapter starts here.')); assert.ok(empty.includes(">Upload CV<")); assert.ok(!empty.includes("Replace"));
 const html = render(createElement(CvManager, { documents: [{ id: "1", filename: "cv.pdf", scanStatus: "CLEAN" }] }));
 assert.ok(html.includes("Replace your CV")); assert.ok(html.includes(">Replace CV<")); assert.ok(html.includes("draft applications switch to the new CV"));
 assert.doesNotMatch(html, /type="file"[^>]*disabled=""/, "Replacing is always possible");
});
