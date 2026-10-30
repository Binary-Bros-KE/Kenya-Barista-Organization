import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { SiteHeader } from "../src/components/site-header";
import { SiteFooter } from "../src/components/site-footer";
import { CoffeeHome } from "../src/components/coffee-home";
import { LegacyShell } from "../src/components/legacy-shell";
import { contactInfo, coffeeGuides } from "../src/content/site-brand";
function render(component: ReactNode, pathname = "/") { return renderToStaticMarkup(createElement(PathnameContext.Provider, { value: pathname }, component)); }
function activeLinks(html: string) { return [...new Set([...html.matchAll(/<a\b([^>]+)>/g)].filter(match=>match[1].includes('aria-current="page"')).map(match=>/href="([^"]+)"/.exec(match[1])?.[1]))]; }
test("shared navigation preserves public, guide, sign-in and account journeys", () => {
 const html=render(createElement(SiteHeader));
 for (const href of ["/", "/registration", "/philosophy", "/team", "/gallery", "/jobs", "/contact", "/dashboard", "/sign-in", ...coffeeGuides.map(([,href])=>href)]) assert.ok(html.includes('href="'+href+'"'),href);
 assert.ok(html.includes('src="/brand-logo.png"')); assert.deepEqual(activeLinks(html), ["/"]);
});
test("nested job and guide routes identify the correct navigation destination", () => {
 assert.deepEqual(activeLinks(render(createElement(SiteHeader),"/jobs/example")),["/jobs"]);
 assert.deepEqual(activeLinks(render(createElement(SiteHeader),"/comparison")),["/comparison"]);
 assert.deepEqual(activeLinks(render(createElement(SiteHeader),"/registration")),["/registration"]);
});
test("mobile navigation exposes a closed labeled modal and named open/close controls", () => {
 const html=render(createElement(SiteHeader)); assert.ok(html.includes('aria-controls="site-mobile-navigation"'));
 assert.ok(html.includes('aria-expanded="false"')); assert.ok(html.includes('aria-label="Open navigation"')); assert.ok(html.includes('aria-label="Close navigation"'));
 assert.ok(html.includes('aria-labelledby="site-mobile-title"')); assert.ok(!/<dialog[^>]*open/.test(html));
});
test("home has one primary heading, separate course and job-account registration and complete route entry points", () => {
 const html=render(createElement(CoffeeHome)); assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.ok(html.includes('href="/registration"')); assert.ok(html.includes('href="/register"')); assert.ok(html.includes('Create a job account'));
 for (const href of ["/jobs","/employer","/contact","/philosophy","/team","/gallery",...coffeeGuides.map(([,href])=>href)]) assert.ok(html.includes('href="'+href+'"'),href);
 assert.equal((html.match(/id="main-content"/g)||[]).length,1); assert.ok(html.includes('href="#main-content"'));
});
test("homepage photography and logos use existing local files with meaningful alternatives", () => {
 const html=render(createElement(CoffeeHome));const images=[...html.matchAll(/<img\b[^>]*>/g)]; assert.ok(images.length>=5);
 for (const [tag] of images) { const src=/src="([^"]+)"/.exec(tag)?.[1]; assert.ok(src?.startsWith("/")); assert.ok(existsSync(resolve(process.cwd(),"public"+src)),src); assert.match(tag,/alt="[^"]+"/); }
 assert.ok(html.includes('fetchPriority="high"')); assert.ok(html.includes('loading="lazy"'));
});
test("footer preserves contact details, social links and all four coffee guides", () => {
 const html=render(createElement(SiteFooter)); assert.ok(html.includes('href="mailto:'+contactInfo.email+'"')); assert.ok(html.includes('href="tel:'+contactInfo.phone+'"'));
 for (const [,href] of coffeeGuides) assert.ok(html.includes('href="'+href+'"'));
 for (const name of ["Facebook","Twitter","Instagram","LinkedIn","YouTube"]) assert.ok(html.includes('aria-label="'+name+'"'));
 assert.ok(html.includes('href="#top"')); assert.ok(html.includes(contactInfo.address));
});
test("inner public pages retain their body and content anchor inside the shared frame", () => {
 const html=render(createElement(LegacyShell,{compact:true,children:createElement("main",null,"Existing sign-in form")} ),"/sign-in");
 assert.ok(html.includes('Existing sign-in form')); assert.ok(html.includes('site-navigation')); assert.ok(html.includes('site-footer'));
 assert.equal((html.match(/id="main-content"/g)||[]).length,1); assert.ok(!html.includes('site-page-intro'));
});
