import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { partnerRequestInput, partnershipKinds } from "../src/server/partner-requests";
import { partnerRequestEmail } from "../src/server/email-templates";
import { PartnerForm } from "../src/components/partner-form";
import { CoffeeHome } from "../src/components/coffee-home";

const valid = { organisation: "Java House", contactName: "Achieng Odhiambo", email: " Achieng@Example.com ", kind: "TRAINING", message: "We'd like to sponsor a latte art throwdown for KBO members." };

test("partner requests need the key details and reject anything unexpected", () => {
  const parsed = partnerRequestInput.parse({ ...valid, phone: "", website: "" });
  assert.equal(parsed.email, "achieng@example.com"); assert.equal(parsed.phone, null); assert.equal(parsed.website, null);
  assert.equal(partnerRequestInput.parse({ ...valid, phone: "+254 712 345 678", website: "javahouse.co.ke" }).website, "javahouse.co.ke");
  for (const broken of [{ organisation: "J" }, { email: "not-an-email" }, { kind: "BRIBE" }, { message: "Too short" }, { phone: "call me" }, { website: "not a site" }, { role: "ADMIN" }])
    assert.equal(partnerRequestInput.safeParse({ ...valid, ...broken }).success, false, JSON.stringify(broken));
  assert.equal(partnerRequestInput.parse({ ...valid, nickname: "bot" }).nickname, "bot", "The honeypot is accepted so bots get no hint");
});

test("the partner request email escapes what people typed and links to the admin tab", () => {
  const email = partnerRequestEmail({ baseUrl: "https://kbo.example", organisation: "Café <script>", contactName: "Brian", email: "brian@example.com", phone: null, website: "cafe.example", kind: partnershipKinds.SUPPLIER, message: "Line one\n<b>Line two</b>" });
  assert.equal(email.subject, "New partner request: Café <script>");
  assert.ok(email.html.includes("Café &lt;script&gt;")); assert.ok(!email.html.includes("<script>")); assert.ok(email.html.includes("Line one<br>&lt;b&gt;Line two"));
  assert.ok(email.html.includes('href="https://kbo.example/admin/partners"')); assert.ok(email.html.includes("mailto:brian@example.com")); assert.ok(!email.html.includes(">Phone<"));
  assert.ok(email.text.includes("Website: cafe.example")); assert.ok(email.text.includes("Interested in: Supplying coffee, milk or equipment"));
});

test("the home page invites partners and the form has every field plus a hidden bot trap", () => {
  const home = renderToStaticMarkup(createElement(PathnameContext.Provider, { value: "/" }, createElement(CoffeeHome)));
  assert.ok(home.indexOf("site-partners-cta") > home.indexOf("site-partners-grid")); assert.ok(home.includes('href="/partner-with-us"'));
  const form = renderToStaticMarkup(createElement(PartnerForm));
  for (const name of ["organisation", "contactName", "email", "phone", "website", "kind", "message"]) assert.ok(form.includes(`name="${name}"`), name);
  for (const value of Object.keys(partnershipKinds)) assert.ok(form.includes(`value="${value}"`), value);
  const trap = form.match(/<label class="partner-form-trap" aria-hidden="true">[^]*?<\/label>/)?.[0] ?? "";
  assert.ok(trap.includes("name=\"nickname\"") && trap.includes("tabindex=\"-1\""), "The bot trap is hidden from people and skipped by the keyboard");
});
