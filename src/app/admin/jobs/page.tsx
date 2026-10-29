import { AdminHeading, AdminQuickLinks } from "@/components/admin-ui";
import { jobPageActor } from "@/lib/job-page-access";
import { Workspace } from "@/components/workspace";
import { FeeSettings } from "@/components/fee-settings";
import { JobList } from "@/components/job-list";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await jobPageActor(true);
  return <Workspace name={actor.user.name || actor.user.email} admin><div className="admin-workspace"><AdminHeading title="Opportunities worth opening." description="Review employer postings, manage approval decisions and configure the default application fee."/><AdminQuickLinks/><FeeSettings /><JobList admin /></div></Workspace>;
}
