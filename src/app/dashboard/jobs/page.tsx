import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { listPublicJobs, publicJobQuery } from "@/server/public-jobs";
import { DashboardJobs } from "@/components/dashboard-jobs";
export const dynamic = "force-dynamic";

// Open jobs inside the workspace, so members can browse and apply without leaving their dashboard.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await pageActor(), db = getDb();
  const params = Object.fromEntries(Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const parsed = publicJobQuery.safeParse({ q: params.q, location: params.location, category: params.category, employmentType: params.employmentType, page: params.page });
  const query = parsed.success ? parsed.data : { page: 1 };
  let data: Awaited<ReturnType<typeof listPublicJobs>> | null = null;
  try { data = await listPublicJobs(db, query); }
  catch { logEvent("error", "jobs.dashboard_list_unavailable"); }
  const mine = data?.jobs.length ? await db.application.findMany({ where: { userId: actor.user.id, jobId: { in: data.jobs.map(job => job.id) } }, select: { id: true, jobId: true, status: true } }) : [];
  return <DashboardJobs query={query} data={data} invalid={!parsed.success} applied={Object.fromEntries(mine.map(application => [application.jobId, { id: application.id, status: application.status }]))} />;
}
