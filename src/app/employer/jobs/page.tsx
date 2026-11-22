import { jobPageActor } from "@/lib/job-page-access";
import { JobList } from "@/components/job-list";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await jobPageActor();
  return <><div className="employer-workspace"><JobList /></div></>;
}
