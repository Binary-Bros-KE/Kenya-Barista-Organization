import { CoffeeHome } from "@/components/coffee-home";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { listPublicJobs } from "@/server/public-jobs";
export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Kenya Barista Organization | Coffee Skills & Careers" }, description: "Discover Kenya Barista Organization: coffee courses, community, guides and career opportunities. Learn the craft and find your next step in coffee." };
export default async function Page() {
  // The home page still renders without the jobs preview if the database is unavailable.
  let latestJobs = null;
  try { const { jobs, pagination } = await listPublicJobs(getDb(), {}); latestJobs = { jobs: jobs.slice(0, 4), total: pagination.total }; }
  catch { logEvent("error", "home.latest_jobs_unavailable"); }
  return <CoffeeHome latestJobs={latestJobs}/>;
}
