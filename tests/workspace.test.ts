import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { Workspace } from "../src/components/workspace";

function render(pathname: string, admin: boolean) {
  return renderToStaticMarkup(createElement(PathnameContext.Provider, { value: pathname }, createElement(Workspace, {
    name: "Coffee Professional", admin, children: createElement("h1", null, "Existing tab content"),
  })));
}
function activeLinks(html: string) {
  return [...new Set([...html.matchAll(/<a\b([^>]+)>/g)].filter(match => match[1].includes('aria-current="page"'))
    .map(match => /href="([^"]+)"/.exec(match[1])?.[1]))];
}

test("normal account navigation preserves applicant routes and hides admin controls", () => {
  const html = render("/dashboard", false);
  for (const route of ["/dashboard/profile", "/dashboard/applications", "/dashboard/payments", "/dashboard/notifications", "/dashboard/security", "/jobs"])
    assert.ok(html.includes(`href="${route}"`), route);
  assert.ok(!html.includes('href="/admin'));
  assert.ok(html.includes("Existing tab content"));
  assert.ok(html.includes('src="/brand-logo.png"'));
  assert.deepEqual(activeLinks(html), ["/dashboard"]);
});
test("nested account pages select their own section rather than the dashboard overview", () => {
  assert.deepEqual(activeLinks(render("/dashboard/applications/example", false)), ["/dashboard/applications"]);
});
test("administrator navigation includes restricted sections without duplicate active parents", () => {
  const html = render("/admin/jobs/example", true);
  for (const route of ["/admin", "/admin/jobs", "/admin/payments", "/admin/notifications"]) assert.ok(html.includes(`href="${route}"`));
  assert.deepEqual(activeLinks(html), ["/admin/jobs"]);
});
test("employer detail routes highlight the correct navigation group", () => {
  assert.deepEqual(activeLinks(render("/employer/jobs/new", false)), ["/employer/jobs"]);
  assert.deepEqual(activeLinks(render("/employer/organisations/example", false)), ["/employer"]);
});
test("mobile drawer and desktop collapse expose named accessible controls", () => {
  const html = render("/dashboard/security", true);
  assert.ok(html.includes('<dialog'));
  for (const label of ["Open navigation", "Close navigation", "Collapse sidebar", "Sign out"]) assert.ok(html.includes(`aria-label="${label}"`));
  assert.ok(html.includes('aria-controls="workspace-mobile-navigation"'));
  assert.ok(html.includes('href="#workspace-content"'));
});
