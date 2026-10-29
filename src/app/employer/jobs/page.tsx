import { jobPageActor } from "@/lib/job-page-access";
import { Workspace } from "@/components/workspace";
import { JobList } from "@/components/job-list";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ organisationId?: string }> }) {
  const actor = await jobPageActor();
  return <Workspace name={actor.user.name || actor.user.email} admin={actor.user.role === "ADMIN"}><h1>Your job postings</h1><p className="intro">Prepare drafts, send them for review, and manage published opportunities.</p><JobList organisationId={(await searchParams).organisationId} /></Workspace>;
}
