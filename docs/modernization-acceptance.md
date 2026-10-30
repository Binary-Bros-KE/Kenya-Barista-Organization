
# Modernization acceptance

## Repeatable checks

- TypeScript: npm run typecheck.
- Public UI contracts and optimized asset integrity: tests/public-website.test.ts, content-pages.test.ts, public-careers.test.ts and public-polish.test.ts.
- Every push runs the full test suite against a disposable PostgreSQL database and mocked Daraja responses, followed by deployment-policy checks and a production build.
- Integration coverage includes registration/verification, MFA and recovery, invitation scope, CV screening, application drafts, idempotent payment/submission, employer responses, withdrawal, and manual reversal records.

## Browser acceptance

Check public pages at 360, 390, 768, 1024 and 1440 CSS pixels; check for page overflow, heading visibility and loaded images. Exercise mobile navigation, Escape and focus return; desktop dropdown keyboard access; coffee-guide tabs using arrows/Home/End; gallery arrows, Escape, focus restoration and body scrolling. Check job search through its GET form and error recovery. Check job-application redirects and continuation links without submitting account or payment forms on the live staging site.

Use existing records for authenticated client review. Do not create real payment prompts for automated QA. Browser checks of open/closed job presentation can use local rendered fixtures when staging has no postings. Browser fixture review does not replace the isolated integration suite.

## Photo delivery

Original archive files remain under public/legacy. WebP delivery copies and thumbnails are committed under public/optimized and mapped in src/content/optimized-photos.json. Rebuild them with node scripts/optimize-public-photos.cjs after installing dependencies. Brochure download links retain their original files. No source article text, team identities or product records are replaced.

## Before production launch

Client acceptance still needs a real applicant/employer walkthrough, approved job content/fees, production Daraja merchant setup and callback validation, and confirmation of the final production domain and email sender. Staging UI and mocked payment tests do not establish live merchant readiness. Reversals remain manual.
