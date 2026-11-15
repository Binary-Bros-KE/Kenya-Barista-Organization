import { EmployerHeading } from "@/components/employer-ui";
import { jobPageActor } from "@/lib/job-page-access";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { JobList } from "@/components/job-list";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await jobPageActor();
  return <WorkspaceFrame actor={actor}><div className="employer-workspace"><EmployerHeading title="Your next great hire starts here." description="Prepare drafts, follow review feedback and manage your opportunities."/><JobList /></div></WorkspaceFrame>;
}
