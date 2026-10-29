import { jobPageActor } from "@/lib/job-page-access";
import { Workspace } from "@/components/workspace";
import { FeeSettings } from "@/components/fee-settings";
import { JobList } from "@/components/job-list";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await jobPageActor(true);
  return <Workspace name={actor.user.name || actor.user.email} admin><h1>Jobs and review</h1><p className="intro">Review employer postings and publish approved opportunities.</p><FeeSettings /><JobList admin /></Workspace>;
}
