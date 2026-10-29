import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { notificationOperations } from "@/server/notification-access";
import { Workspace } from "@/components/workspace";
import { RetryNotification } from "@/components/notification-controls";
import { formatDeadline } from "@/lib/job-format";
export const dynamic="force-dynamic";
export default async function Page(){
 const actor=await pageActor(true),result=await notificationOperations(getDb(),actor);
 return <Workspace name={actor.user.name||actor.user.email} admin><h1>Notification delivery</h1><p className="intro">Monitor queued events and email attempts.</p>
 <div className="grid gap-4 sm:grid-cols-3">{[["Pending events",result.counts.eventsPending],["Failed events",result.counts.eventsFailed],["Pending emails",result.counts.deliveriesPending],["Failed emails",result.counts.deliveriesFailed],["Accepted emails",result.counts.sent],["Skipped emails",result.counts.skipped]].map(([label,count])=><div className="card" key={String(label)}><p className="hint">{label}</p><p className="mt-2 text-3xl font-semibold">{count}</p></div>)}</div>
 <p className="hint my-5">Oldest pending event: {result.oldestPendingAt?formatDeadline(result.oldestPendingAt):"None"}. Accepted means the mail server accepted the message, or a local preview file was written.</p>
 <p className="notice mb-6">Fix SMTP or worker configuration before retrying failed work. An email accepted just before a worker crash may be sent again on retry.</p>
 <section className="mt-8"><h2>Failed events</h2><div className="mt-4 grid gap-4">{result.events.map(event=><article className="card" key={event.id}><h3>{event.kind}</h3><p className="hint">Attempts: {event.attempts} · {event.lastError}</p><RetryNotification id={event.id} target="event" /></article>)}{!result.events.length&&<p>No failed events.</p>}</div></section>
 <section className="mt-8"><h2>Failed emails</h2><div className="mt-4 grid gap-4">{result.deliveries.map(item=><article className="card" key={item.id}><h3>{item.user.email}</h3><p>{item.kind}</p><p className="hint">Attempts: {item.attempts} · {item.lastError}</p><RetryNotification id={item.id} target="delivery" /></article>)}{!result.deliveries.length&&<p>No failed emails.</p>}</div></section><p className="hint mt-6">Each failure list shows the latest 50 entries.</p></Workspace>;
}

