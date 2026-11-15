import { AdminHeading, AdminQuickLinks } from "@/components/admin-ui";
import { jobPageActor } from "@/lib/job-page-access";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { FeeSettings } from "@/components/fee-settings";
import { JobList } from "@/components/job-list";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await jobPageActor(true);
  return <WorkspaceFrame actor={actor}><div className="admin-workspace"><AdminHeading title="Opportunities worth opening." description="Review employer postings, manage approval decisions and configure the default application fee."/><AdminQuickLinks/><FeeSettings /><JobList admin /></div></WorkspaceFrame>;
}
