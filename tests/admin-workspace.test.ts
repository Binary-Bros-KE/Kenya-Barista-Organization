import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { AdminConfirm } from "../src/components/admin-confirm";
import { AdminQuickLinks } from "../src/components/admin-ui";
import { AdminPanel } from "../src/components/admin-panel";
import { AdminDelivery } from "../src/components/admin-delivery";
import { MpesaSettingsForm } from "../src/components/mpesa-settings";
import { ManualReversal } from "../src/components/manual-reversal";
import { PaymentReviewForm } from "../src/components/payment-review-form";
function render(component: ReactNode) { return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as never }, component)); }
test("administration navigation retains all operations and initial loading does not invent records", () => {
 const links = render(createElement(AdminQuickLinks)); for (const route of ["/admin", "/admin/jobs", "/admin/payments", "/admin/notifications"]) assert.ok(links.includes('href="'+route+'"'));
 const html = render(createElement(AdminPanel)); for (const tab of ["Organisations", "Invitations", "Employer access", "Accounts", "Activity"]) assert.ok(html.includes(tab));
 assert.ok(html.includes('Loading administration...')); assert.ok(!html.includes('No accounts match'));
});
test("access changes use a closed disclosure with distinct confirmation and cancellation controls", () => {
 const html = render(createElement(AdminConfirm, { label: "Suspend account", explanation: "Sessions will be revoked.", busy: false, onConfirm() {} }));
 assert.ok(html.includes('<details')); assert.ok(!/<details[^>]*open/.test(html));
 assert.ok(html.includes('Confirm suspend account')); assert.ok(html.includes('Cancel')); assert.ok(html.includes('Sessions will be revoked.'));
 const busy = render(createElement(AdminConfirm, { label: "Remove access", explanation: "Confirm removal.", busy: true, onConfirm() {} }));
 assert.equal((busy.match(/disabled=""/g)||[]).length, 2);
});
test("merchant setup requires all secrets for a new configuration and never fills stored secrets", () => {
 const fresh = render(createElement(MpesaSettingsForm, { configurations: [] }));
 const saved = render(createElement(MpesaSettingsForm, { configurations: [{ id: "cfg", label: "KBO Paybill", kind: "PAYBILL", environment: "SANDBOX", businessShortCode: "174379", tillNumber: null, enabled: false }] }));
 for (const name of ["consumerKey", "consumerSecret", "passkey"]) {
 const input = (html: string) => [...html.matchAll(/<input[^>]*>/g)].map(([value])=>value).find(value=>value.includes('name="'+name+'"'))!;
 assert.ok(input(fresh).includes('required=""')); assert.ok(!input(saved).includes('required=""'));
 assert.ok(!input(saved).includes('value=')); assert.ok(input(saved).includes('type="password"'));
 }
 assert.ok(saved.includes('Leave all three fields empty to retain them')); assert.ok(fresh.includes('Buy Goods / Till'));
 assert.ok(fresh.includes('No collection options are enabled.'));
});
test("manual reversal requires an existing-return acknowledgement, reference and private note", () => {
 const html = render(createElement(ManualReversal, { orderId: "order", attemptId: "attempt" }));
 assert.ok(html.includes('Return the full payment to the original payer outside this site'));
 assert.ok([...html.matchAll(/<input[^>]*>/g)].some(([input])=>input.includes('name="confirmed"')&&input.includes('required=""')));
 assert.ok(html.includes('minLength="5"')); assert.ok(html.includes('minLength="10"')); assert.ok(html.includes('Mark payment reversed'));
 assert.ok(!html.includes('Recheck with Daraja'));
});
test("payment decisions default to private notes and require an available attempt", () => {
 const html = render(createElement(PaymentReviewForm, { orderId: "order", version: 1, attempts: [] }));
 assert.ok(html.includes('Add private note')); assert.ok(html.includes('Private notes stay in administration'));
 assert.match(html, /<button[^>]*disabled/); assert.ok(!html.includes('name="receipt"'));
 assert.ok(!html.includes('name="statementChecked"'));
});
test("delivery overview distinguishes accepted mail from inbox delivery and escapes diagnostics", () => {
 const html = render(createElement(AdminDelivery, { result: { counts: { eventsPending: 2, eventsFailed: 1, deliveriesPending: 3, deliveriesFailed: 0, sent: 8, skipped: 4 }, oldestPendingAt: null, events: [{ id: "event", kind: "job.updated", attempts: 2, lastError: "<script>diagnostic</script>" }], deliveries: [] } }));
 assert.ok(html.includes('It does not confirm inbox delivery.')); assert.ok(html.includes('Retry failed event')); assert.ok(!html.includes('Retry failed email'));
 assert.ok(html.includes('&lt;script&gt;diagnostic&lt;/script&gt;')); assert.ok(!html.includes('<script>diagnostic'));
 assert.ok(html.includes('No failed emails.')); assert.ok(html.includes('Oldest pending event:'));
});
