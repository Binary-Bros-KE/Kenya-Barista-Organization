# Account pages within the original website

Prepared release: /home/evans/barista-platform/releases/20261029T070743388Z-auth-ui
Previous release: /home/evans/barista-platform/releases/20261016T160536337Z

Account routes now reuse LegacyShell with the original coffee background, navigation, logo, typography and footer. A compact hero keeps forms accessible without scrolling through the full public-page banner. Removed the isolated auth card layout. Shared public navigation now uses the existing brand-logo.png instead of the text wordmark. Auth form submissions, password/email verification and MFA logic are unchanged. No schema/dependency changes or new assets.

Validation: production compilation, TypeScript and static generation passed; HTTP checks passed for seven auth routes, home/jobs/gallery, compiled account CSS, logo and font. Browser-controlled visual/mobile interaction QA was unavailable. Temporary preview was stopped after checks.

Activation is pending owner sudo: run deploy/staging/activate-ui-update.sh in this release. It checks that the current release still matches the prepared source, selects the verified build, restarts only barista-staging-web, and checks readiness. If startup/readiness fails it restores the prior release and restarts the web service. No Nginx, database or other application changes.
