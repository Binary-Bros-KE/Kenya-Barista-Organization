import { EmployerHeading } from "@/components/employer-ui";
import { jobPageActor } from "@/lib/job-page-access";
import { Workspace } from "@/components/workspace";
import { JobEditor } from "@/components/job-editor";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ organisationId?: string }> }) {
  const actor = await jobPageActor();
  return <Workspace name={actor.user.name || actor.user.email} admin={actor.user.role === "ADMIN"}><div className="employer-workspace"><EmployerHeading title="Make room for new talent." description="Create a draft, review the saved details and send your posting for approval." back={{ href: "/employer/jobs", label: "Your job postings" }}/><JobEditor admin={actor.user.role === "ADMIN"} initialOrganisationId={(await searchParams).organisationId} /></div></Workspace>;
}
