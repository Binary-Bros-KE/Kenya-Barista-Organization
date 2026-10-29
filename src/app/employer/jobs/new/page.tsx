import { jobPageActor } from "@/lib/job-page-access";
import { Workspace } from "@/components/workspace";
import { JobEditor } from "@/components/job-editor";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ organisationId?: string }> }) {
  const actor = await jobPageActor();
  return <Workspace name={actor.user.name || actor.user.email} admin={actor.user.role === "ADMIN"}><h1>Create a job posting</h1><p className="intro">Save your draft, preview it, then submit it for review.</p><JobEditor admin={actor.user.role === "ADMIN"} initialOrganisationId={(await searchParams).organisationId} /></Workspace>;
}
