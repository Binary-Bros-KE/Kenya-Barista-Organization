import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { JobCard } from "@/components/job-card";
import { categories, employmentTypes } from "@/lib/job-format";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { listPublicJobs, publicJobFacets, publicJobQuery } from "@/server/public-jobs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Coffee jobs in Kenya", description: "Discover barista, roasting, hospitality, and other coffee career opportunities in Kenya." };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const result = publicJobQuery.safeParse(Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])));
  if (!result.success) return <PublicShell><main className="py-14"><h1>Find your next opportunity</h1><p role="alert" className="notice error mt-8">Check your search filters and page number.</p><Link href="/jobs" className="button mt-5">Clear search</Link></main></PublicShell>;
  const query = result.data;
  let data: Awaited<ReturnType<typeof listPublicJobs>> | null = null;
  let organisations: Awaited<ReturnType<typeof publicJobFacets>> = [];
  try { [data, organisations] = await Promise.all([listPublicJobs(getDb(), query), publicJobFacets(getDb())]); }
  catch { logEvent("error", "jobs.public_page_unavailable"); }
  function pageLink(page: number) {
    const values = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (key !== "page" && value) values.set(key, String(value));
    values.set("page", String(page)); return `/jobs?${values}`;
  }
  return <PublicShell><main className="py-12"><p className="mb-4 text-xs font-bold uppercase tracking-widest text-emerald-800">Coffee careers</p><h1>Find your next opportunity</h1><p className="intro max-w-2xl">Explore opportunities across Kenya&apos;s coffee community, from your first barista role to your next leadership position.</p>
    <form action="/jobs" method="get" className="card form-stack"><div className="grid gap-5 sm:grid-cols-2"><label>Keywords<input name="q" type="search" maxLength={120} defaultValue={query.q} placeholder="Job title, skills, or employer" /></label><label>Location<input name="location" maxLength={120} defaultValue={query.location} placeholder="Town or county" /></label></div><div className="grid gap-5 sm:grid-cols-3"><label>Category<select name="category" defaultValue={query.category || ""}><option value="">All categories</option>{Object.entries(categories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Employment type<select name="employmentType" defaultValue={query.employmentType || ""}><option value="">All types</option>{Object.entries(employmentTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Employer<select name="organisation" defaultValue={query.organisation || ""}><option value="">All employers</option>{organisations.map(org => <option key={org.slug} value={org.slug}>{org.name}</option>)}</select></label></div><div className="flex items-center gap-5"><button className="button">Search opportunities</button><Link href="/jobs" className="text-sm underline">Clear filters</Link></div></form>
    {!data ? <p role="alert" className="notice error mt-8">Job listings are temporarily unavailable. Please try again shortly.</p> : <><p role="status" className="my-7 text-sm text-stone-600">{data.pagination.total} available opportunit{data.pagination.total === 1 ? "y" : "ies"}</p>{data.jobs.length ? <div className="grid gap-5 md:grid-cols-2">{data.jobs.map(job => <JobCard job={job} key={job.slug} />)}</div> : <div className="card py-12"><h2>No opportunities match this search</h2><p className="mt-3 text-stone-600">Try another location, fewer keywords, or check back for new postings.</p></div>}<nav aria-label="Search results pages" className="mt-8 flex flex-wrap items-center gap-5">{query.page > 1 && <Link className="button secondary" href={pageLink(query.page - 1)}>Previous</Link>}<span className="text-sm">Page {query.page} of {Math.max(1, data.pagination.pageCount)}</span>{query.page < data.pagination.pageCount && <Link className="button secondary" href={pageLink(query.page + 1)}>Next</Link>}</nav></>}
  </main></PublicShell>;
}
