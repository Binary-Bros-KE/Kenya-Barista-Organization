import { AdminHeading, AdminQuickLinks } from "@/components/admin-ui";
import { pageActor } from "@/lib/access";
import { Workspace } from "@/components/workspace";
import { AdminPanel } from "@/components/admin-panel";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await pageActor(true);
  return <Workspace name={actor.user.name || actor.user.email} admin><div className="admin-workspace"><AdminHeading title="Keep the platform moving." description="Manage organisations, employer access and account activity from one place."/><AdminQuickLinks/><AdminPanel /></div></Workspace>;
}
