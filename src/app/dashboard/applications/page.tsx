import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { ApplicationList } from "@/components/application-list";
import { applicantApplicationList } from "@/server/applicant-application-list";
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const actor = await pageActor();
  const result = await applicantApplicationList(getDb(), actor, await searchParams);
  return <ApplicationList {...result} />;
}
