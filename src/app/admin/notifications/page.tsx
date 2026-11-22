import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { notificationOperations } from "@/server/notification-access";
import { AdminHeading, AdminQuickLinks } from "@/components/admin-ui";
import { AdminDelivery } from "@/components/admin-delivery";
export const dynamic = "force-dynamic";
export default async function Page() {
 const actor = await pageActor(true), result = await notificationOperations(getDb(),actor);
 return <><div className="admin-workspace"><AdminHeading title="Keep updates on their way." description="Monitor notification processing, inspect failures and retry work after resolving the cause."/><AdminQuickLinks/><AdminDelivery result={result}/></div></>;
}
