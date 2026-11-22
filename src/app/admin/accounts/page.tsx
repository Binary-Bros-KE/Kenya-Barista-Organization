import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { AdminAccounts } from "@/components/admin-accounts";
import { listAccounts } from "@/server/admin-accounts";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await pageActor(true);
  const data = await listAccounts(getDb(), actor, await searchParams);
  return <><AdminAccounts data={data} selfId={actor.user.id} /></>;
}
