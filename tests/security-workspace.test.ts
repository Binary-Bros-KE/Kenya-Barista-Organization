import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SecurityOverview } from "../src/components/security-overview";
import { parseAuthenticatorEnrolment } from "../src/lib/security-view";
function render(component: ReactNode) { return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as never }, component)); }
function overview(admin: boolean, enabled: boolean, verified: boolean) { return render(createElement(SecurityOverview, { admin, enabled, verified, email: "person@example.com" })); }
test("administrators without verified MFA see the requirement and cannot open administration", () => {
 for (const [enabled, verified] of [[false, false], [true, false], [false, true]]) {
 const html = overview(true, enabled, verified); assert.ok(html.includes('Required for admins')); assert.ok(!html.includes('href="/admin"')); assert.ok(!html.includes('This session is verified'));
 }
});
test("verified administrators receive the administration link and no setup or code form", () => {
 const html = overview(true, true, true); assert.ok(html.includes('href="/admin"')); assert.ok(html.includes('This session is verified'));
 assert.ok(!html.includes('name="password"')); assert.ok(!html.includes('name="code"'));
});
test("normal accounts retain optional MFA and never receive an administration shortcut", () => {
 for (const enabled of [true, false]) { const html = overview(false, enabled, enabled); assert.ok(html.includes('Optional protection')); assert.ok(!html.includes('href="/admin"')); }
});
test("initial enrollment asks for current password without pre-rendering setup secrets", () => {
 const html = overview(false, false, false); assert.ok(html.includes('autoComplete="current-password"')); assert.ok(html.includes('Set up authenticator'));
 assert.ok(!html.includes('id="security-setup-key"')); assert.ok(!html.includes('id="security-recovery-codes"')); assert.ok(!html.includes('name="code"'));
});
test("enabled but unverified sessions have code constraints and recovery choice without setup password", () => {
 const html = overview(true, true, false); assert.ok(html.includes('pattern="[0-9]{6}"')); assert.ok(html.includes('autoComplete="one-time-code"')); assert.ok(html.includes('Use a recovery code instead'));
 assert.ok(!html.includes('name="password"')); assert.ok(html.includes('Second factor not verified'));
});
test("enrollment parsing accepts time-based keys and rejects invalid responses without disclosing secret input", () => {
 const secret = "JBSWY3DPEHPK3PXP", backupCodes = ["one-time-recovery"];
 assert.deepEqual(parseAuthenticatorEnrolment({ totpURI: "otpauth://totp/KBO?secret="+secret, backupCodes }), { secret, backupCodes });
 for (const data of [null, {}, { totpURI: "https://example.com/?secret="+secret, backupCodes }, { totpURI: "otpauth://hotp/KBO?secret="+secret, backupCodes }, { totpURI: "otpauth://totp/KBO?secret=bad!", backupCodes }, { totpURI: "otpauth://totp/KBO?secret="+secret, backupCodes: [] }]) assert.throws(() => parseAuthenticatorEnrolment(data), { message: "Setup could not be loaded. Try again." });
});
test("account recovery guidance does not promise a password reset will remove MFA", () => {
 const html = overview(false, true, false); assert.ok(html.includes('A password reset alone does not remove two-factor authentication.')); assert.ok(html.includes('href="/forgot-password"')); assert.ok(html.includes('Never send your password, setup key or recovery codes to anyone.'));
});
