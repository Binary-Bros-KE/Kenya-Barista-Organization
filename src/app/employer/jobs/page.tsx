import { EmployerHeading } from "@/components/employer-ui";
import { jobPageActor } from "@/lib/job-page-access";
import { Workspace } from "@/components/workspace";
import { JobList } from "@/components/job-list";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ organisationId?: string }> }) {
  const actor = await jobPageActor();
  return <Workspace name={actor.user.name || actor.user.email} admin={actor.user.role === "ADMIN"}><div className="employer-workspace"><EmployerHeading title="Your next great hire starts here." description="Prepare drafts, follow review feedback and manage opportunities across your organisations."/><JobList organisationId={(await searchParams).organisationId} /></div></Workspace>;
}
