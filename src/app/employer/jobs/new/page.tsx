import { EmployerHeading } from "@/components/employer-ui";
import { jobPageActor } from "@/lib/job-page-access";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { JobEditor } from "@/components/job-editor";
import { imagesEnabled } from "@/server/images";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await jobPageActor();
  return <WorkspaceFrame actor={actor}><div className="employer-workspace"><EmployerHeading title="Make room for new talent." description="Create a draft, review the saved details and send your posting for approval." back={{ href: "/employer/jobs", label: "Your job postings" }}/><JobEditor admin={actor.user.role === "ADMIN"} imagesEnabled={imagesEnabled()} /></div></WorkspaceFrame>;
}
