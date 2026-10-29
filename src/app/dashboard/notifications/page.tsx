import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { listNotifications } from "@/server/notification-access";
import { NotificationInbox } from "@/components/notification-inbox";
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; unread?: string }> }) {
 const actor = await pageActor(), query = await searchParams, raw = Number(query.page || 1), page = Number.isInteger(raw) ? Math.min(Math.max(raw, 1), 100000) : 1, unread = query.unread === "true";
 return <NotificationInbox result={await listNotifications(getDb(), actor, { page, unread: unread ? "true" : "false" })} enabled={actor.user.notificationEmails} unread={unread}/>;
}
