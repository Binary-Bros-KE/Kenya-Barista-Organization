import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { AdminRecruiters } from "@/components/admin-recruiters";
import { AdminRecruiterRequests } from "@/components/admin-recruiter-requests";
import { listRecruiters } from "@/server/admin-recruiters";
import { listRecruiterRequests } from "@/server/recruiter-requests";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await pageActor(true);
  const params = await searchParams;
  return <>{params.view === "requests"
    ? <AdminRecruiterRequests data={await listRecruiterRequests(getDb(), actor, params)} />
    : <AdminRecruiters data={await listRecruiters(getDb(), actor, params)} />}</>;
}
