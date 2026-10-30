import { publicPhoto, publicArticleHtml } from "../src/lib/public-photo";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import Courses from "../src/app/registration/page";
import Philosophy from "../src/app/philosophy/page";
import Team from "../src/app/team/page";
import Gallery from "../src/app/gallery/page";
import Contact from "../src/app/contact/page";
import { LegacyGallery } from "../src/components/legacy-gallery";
import { LegacyGuidePage } from "../src/components/legacy-guide-page";
import { LegacyEnquiry } from "../src/components/legacy-enquiry";
import { enquiryDraft } from "../src/lib/enquiry-draft";
import { contactInfo } from "../src/content/site-brand";
import content from "../src/content/legacy-site.json";
import guides from "../src/content/legacy-guides.json";
function render(component: ReactNode, pathname = "/registration") { return renderToStaticMarkup(createElement(PathnameContext.Provider, { value: pathname }, component)); }
function input(html: string, name: string) { return [...html.matchAll(/<input[^>]*>/g)].map(([tag])=>tag).find(tag=>tag.includes('name="'+name+'"')) || ""; }
test("enquiry drafts safely encode subject/body and preserve course selection without server submission", () => {
 const fields: [string,string][] = [["Name","A & B"],["Subject","Coffee & jobs? x=y"],["Message","First line"+String.fromCharCode(10)+"Second line"]];
 const url = new URL(enquiryDraft(fields,false)); assert.equal(url.protocol,"mailto:"); assert.equal(url.pathname,contactInfo.email);
 assert.equal(url.searchParams.get("subject"),"Coffee & jobs? x=y"); assert.ok(url.searchParams.get("body")?.includes("Name: A & B")); assert.equal(url.searchParams.size,2);
 const course = new URL(enquiryDraft([["Course Taken","Roasting Course"],["Phone Number","+254712345678"]],true)); assert.equal(course.searchParams.get("subject"),"Course registration enquiry: Roasting Course"); assert.ok(course.searchParams.get("body")?.includes("+254712345678"));
});
test("course form retains required contact fields and optional demographic fields with honest email-app wording", () => {
 const html=render(createElement(LegacyEnquiry,{course:true}));
 for(const name of ["First Name","Last Name","Email Address","Phone Number"])assert.ok(input(html,name).includes('required=""'),name);
 assert.ok(!input(html,"Age").includes('required=""')); assert.ok(!input(html,"Nationality").includes('required=""'));
 assert.ok(html.includes('name="Gender"')); assert.ok(html.includes('Roasting Course')); assert.ok(html.includes('This form does not send a message directly.'));
});
test("courses retain both brochures, venue and separate job-account entry", () => {
 const html=render(createElement(Courses));
 for(const key of ["https://ik.imagekit.io/qxekjpfx0b/KBO/courses_xfs8iQ-5p.jpg","https://ik.imagekit.io/qxekjpfx0b/KBO/jowam_iDzN1TSEvYNC.jpeg"])assert.ok(html.includes(content.assets[key as keyof typeof content.assets]));
 assert.ok(html.includes('confirm current course availability, fees and training dates')); assert.ok(html.includes('Caxton Hse.')); assert.ok(html.includes('href="/register"')); assert.ok(html.includes('id="course-enquiry"'));
});
test("team and philosophy preserve every supplied member, role and core value", () => {
 const team=render(createElement(Team),"/team"),philosophy=render(createElement(Philosophy),"/philosophy");
 for(const member of content.team){assert.ok(team.includes(member.name));assert.ok(team.includes(member.role));assert.ok(team.includes(publicPhoto(member.image)));}
 for(const value of content.philosophy.values)assert.ok(philosophy.includes(value.title),value.title);
 assert.ok(philosophy.includes('14 June 2014')); assert.ok(philosophy.includes('Constitution of KBO'));
});
test("contact page retains direct contact channels and field limits", () => {
 const html=render(createElement(Contact),"/contact"); assert.ok(html.includes('href="tel:'+contactInfo.phone+'"')); assert.ok(html.includes('href="mailto:'+contactInfo.email+'"'));
 assert.ok(input(html,"Email Address").includes('type="email"')); assert.ok(input(html,"Subject").includes('maxLength="160"')); assert.ok(html.includes('maxLength="3000"'));
 assert.ok(html.includes('Open email draft'));
});
test("gallery and product showcase preserve source images without introducing a purchase flow", () => {
 const html=render(createElement(Gallery),"/gallery");
 for(const photo of [...content.gallery,...content.shop]){assert.ok(html.includes(publicPhoto(photo.src,"small")),photo.src);assert.ok(existsSync(resolve(process.cwd(),"public"+photo.src)),photo.src);}
 assert.ok(html.includes('Online purchasing is coming soon')); assert.ok(html.includes('Product showcase viewer')); assert.ok(!html.includes('Add to cart'));
});
test("gallery viewer starts closed, labels controls and handles unavailable/single-image sets", () => {
 const html=render(createElement(LegacyGallery,{photos:[{src:"",alt:"Missing"},{src:"/legacy/484b5cd378beff4a.jpg",alt:"Coffee photo"}]}));
 assert.ok(html.includes('Photo unavailable')); assert.ok(html.includes('aria-label="Open Coffee photo"')); assert.ok(html.includes('aria-label="Close image viewer"'));
 assert.ok(html.includes('aria-describedby=')); assert.ok(!/<dialog[^>]*open/.test(html)); assert.equal((html.match(/disabled=""/g)||[]).length,2);
});
test("all coffee guides retain complete original articles and interactive tab/accordion markup", () => {
 for(const slug of Object.keys(guides) as (keyof typeof guides)[]){const html=render(createElement(LegacyGuidePage,{slug}),"/"+slug);assert.ok(html.includes(publicArticleHtml(guides[slug].html)),slug+" article preserved");assert.ok(html.includes('aria-label="Coffee guide articles"'));assert.ok([...html.matchAll(/<a[^>]*>/g)].some(([tag])=>tag.includes('href="/'+slug+'"')&&tag.includes('aria-current="page"')));assert.ok(html.includes('id="main-content"'));}
 const bean=render(createElement(LegacyGuidePage,{slug:"bean"}),"/bean");assert.ok(bean.includes('data-legacy-tabs'));assert.ok(bean.includes('<details'));
});
