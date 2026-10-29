import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ProfileForm, CvManager, cvPresentation, validateCvSelection } from "../src/components/profile-workspace";
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
test("profile preserves required details, Kenyan phone validation and optional summary", () => {
 const html = render(createElement(ProfileForm, { initial: { fullName: "Coffee Professional", phone: "+254712345678", location: "Nairobi", summary: "" } }));
 assert.ok(html.includes('pattern="\\+254[17][0-9]{8}"'));
 for (const name of ["fullName", "phone", "location"]) assert.ok([...html.matchAll(/<input[^>]*>/g)].some(([input]) => input.includes('name="'+name+'"') && input.includes('required=""')));
 assert.ok(!/<textarea[^>]*required/.test(html));
 assert.ok(html.includes('maxLength="3000"'));
 assert.ok(html.includes('autoComplete="tel"'));
});
test("CV collection hides blocked downloads, explains retained attachments and asks before deletion", () => {
 const html = render(createElement(CvManager, { documents: [
 { id: "clean", filename: "ready.pdf", scanStatus: "CLEAN", attachmentCount: 1 },
 { id: "pending", filename: "screening.pdf", scanStatus: "PENDING" },
 { id: "rejected", filename: "blocked.pdf", scanStatus: "REJECTED" },
 ] }));
 assert.ok(html.includes('href="/api/documents/clean"')); assert.ok(html.includes('href="/api/documents/pending"')); assert.ok(!html.includes('href="/api/documents/rejected"'));
 assert.ok(html.includes('Submitted attachments are retained.'));
 assert.match(html, /class="profile-remove" disabled=""/);
 assert.ok(!html.includes('Yes, remove CV'));
 assert.ok(html.includes('Refresh status'));
});
test("empty collection gives an honest first-upload state and a full collection disables uploads", () => {
 assert.ok(render(createElement(CvManager, { documents: [] })).includes('Your next chapter starts here.'));
 const html = render(createElement(CvManager, { documents: Array.from({ length: 5 }, (_, i) => ({ id: String(i), filename: "cv.pdf", scanStatus: "CLEAN" })) }));
 assert.ok(html.includes('Your collection is full.'));
 assert.match(html, /type="file"[^>]*disabled=""/);
});
