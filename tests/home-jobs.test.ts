import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { CoffeeHome } from "../src/components/coffee-home";
import type { PublicJob } from "../src/components/job-card";

const render = (latestJobs?: { jobs: PublicJob[]; total: number } | null) => renderToStaticMarkup(createElement(PathnameContext.Provider, { value: "/" }, createElement(CoffeeHome, { latestJobs })));
const job = (n: number, verified = false): PublicJob => ({ id: `job_${n}`, coverVersion: null, slug: `role-${n}`, title: `Head <Barista> ${n}`, location: "Westlands, Nairobi", category: "BARISTA", employmentType: "FULL_TIME",
  deadline: new Date("2030-01-15T14:00:00Z"), publishedAt: new Date(), applicationFeeMinor: 10000, summary: "", employer: { id: `emp_${n}`, name: "Java House", verified, avatarVersion: null } });

test("the home page previews the latest jobs between the pathway cards and the purpose section", () => {
  const html = render({ jobs: [job(1, true), job(2), job(3), job(4)], total: 9 });
  const pathways = html.indexOf("site-pathways"), preview = html.indexOf("site-latest-jobs"), purpose = html.indexOf('id="our-purpose"');
  assert.ok(pathways < preview && preview < purpose, "The preview sits between the pathway cards and the purpose section");
  assert.equal((html.match(/class="career-job-card site-job-preview"/g) || []).length, 4);
  assert.ok(html.includes(">Now hiring</h2>")); assert.ok(!html.includes("NOW HIRING")); assert.ok(html.includes("Explore job openings posted by verified recruiters.")); assert.ok(html.includes("See all 9 postings")); assert.ok(html.includes('href="/jobs"'));
  assert.ok(html.includes('href="/jobs/role-1"')); assert.ok(html.includes("Head &lt;Barista&gt; 1")); assert.ok(!html.includes("<Barista>"));
  assert.ok(html.includes("Westlands, Nairobi")); assert.ok(html.includes("Closes ")); assert.ok(html.includes("Full time"));
  assert.equal((html.match(/verified-ribbon/g) || []).length, 1, "Only verified employers get the ribbon");
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(render({ jobs: [job(1)], total: 1 }).includes("See all 1 posting <"));
});

test("the home page leaves the preview out when there are no open jobs or the jobs can't load", () => {
  for (const latest of [undefined, null, { jobs: [], total: 0 }]) {
    const html = render(latest);
    assert.ok(!html.includes("site-latest-jobs")); assert.ok(html.includes('id="our-purpose"'));
  }
});
