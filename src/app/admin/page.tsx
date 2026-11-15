import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { AdminRecruiters } from "@/components/admin-recruiters";
import { listRecruiters } from "@/server/admin-recruiters";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await pageActor(true);
  const data = await listRecruiters(getDb(), actor, await searchParams);
  return <WorkspaceFrame actor={actor}><AdminRecruiters data={data} /></WorkspaceFrame>;
}
