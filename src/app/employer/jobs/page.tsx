import { jobPageActor } from "@/lib/job-page-access";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { JobList } from "@/components/job-list";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await jobPageActor();
  return <WorkspaceFrame actor={actor}><div className="employer-workspace"><JobList /></div></WorkspaceFrame>;
}
