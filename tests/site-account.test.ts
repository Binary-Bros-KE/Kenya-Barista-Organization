import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteAccountView, SiteMobileAccountView, type SiteUser } from "../src/components/site-account";

const member: SiteUser = { id: "user_1", name: "Achieng <b>Odhiambo</b>", email: "achieng@example.invalid", role: "APPLICANT", avatarVersion: null, unread: 0 };
const render = (user: SiteUser | null | undefined, mobile = false) => renderToStaticMarkup(createElement(mobile ? SiteMobileAccountView : SiteAccountView, { user, onNavigate: () => {} }));

test("the website header shows sign-in buttons to visitors and an account menu once signed in", () => {
  const checking = render(undefined);
  assert.ok(checking.includes("is-checking")); assert.ok(checking.includes('aria-hidden="true"'), "Buttons stay hidden until we know who is signed in");
  const visitor = render(null);
  assert.ok(visitor.includes('href="/sign-in"')); assert.ok(visitor.includes("My account")); assert.ok(!visitor.includes("is-checking"));
  const signedIn = render(member);
  assert.ok(!signedIn.includes('href="/sign-in"')); assert.ok(!signedIn.includes("My account"));
  assert.ok(signedIn.includes('name="site-nav"'), "The account menu closes the other header dropdowns when opened");
  assert.ok(signedIn.includes("Achieng &lt;b&gt;Odhiambo&lt;/b&gt;")); assert.ok(!signedIn.includes("<b>Odhiambo"));
  assert.ok(signedIn.includes("achieng@example.invalid")); assert.ok(render({ ...member, name: "Achieng Odhiambo" }).includes(">AO<"), "Initials stand in for a missing photo");
  assert.ok(signedIn.includes("Member")); assert.ok(signedIn.includes('href="/dashboard/applications"')); assert.ok(signedIn.includes("Sign out"));
  assert.ok(!signedIn.includes("/employer/jobs")); assert.ok(!signedIn.includes("/admin/jobs")); assert.ok(!signedIn.includes("site-user-dot"));
  const recruiter = render({ ...member, role: "RECRUITER", unread: 3 });
  assert.ok(recruiter.includes('href="/employer/jobs"')); assert.ok(recruiter.includes("Recruiter")); assert.ok(recruiter.includes("Notifications (3)")); assert.ok(recruiter.includes("site-user-dot"));
  const admin = render({ ...member, role: "ADMIN", unread: 250 });
  assert.ok(admin.includes('href="/admin/jobs"')); assert.ok(admin.includes("Administrator")); assert.ok(admin.includes("Notifications (99+)"));
  const mobile = render(member, true);
  assert.ok(mobile.includes("site-mobile-user")); assert.ok(!mobile.includes('href="/sign-in"')); assert.ok(mobile.includes("Sign out"));
  assert.ok(render(null, true).includes('href="/sign-in"'));
});
