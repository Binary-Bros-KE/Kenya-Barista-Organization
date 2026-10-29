import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { getDashboardOverview } from "@/server/dashboard-overview";
import { DashboardOverview } from "@/components/dashboard-overview";

export default async function Page() {
  const actor = await pageActor();
  const data = await getDashboardOverview(getDb(), actor);
  return <DashboardOverview data={data} user={actor.user} />;
}
