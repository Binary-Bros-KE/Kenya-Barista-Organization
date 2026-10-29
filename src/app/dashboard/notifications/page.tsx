import Link from "next/link";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { listNotifications } from "@/server/notification-access";
import { NotificationPreference,MarkNotificationRead } from "@/components/notification-controls";
import { formatDeadline } from "@/lib/job-format";
export default async function Page({searchParams}:{searchParams:Promise<{page?:string;unread?:string}>}){
 const actor=await pageActor(),query=await searchParams,raw=Number(query.page||1),page=Number.isInteger(raw)?Math.min(Math.max(raw,1),100000):1,unread=query.unread==="true"?"true":"false";
 const result=await listNotifications(getDb(),actor,{page,unread});
 return <><h1>Your notifications</h1><p className="intro">Job and application updates in one place.</p><NotificationPreference enabled={actor.user.notificationEmails} />
 <div className="mb-5 flex flex-wrap justify-between gap-4"><p>{result.unread} unread notification(s)</p><Link className="underline" href={unread==="true"?"/dashboard/notifications":"/dashboard/notifications?unread=true"}>{unread==="true"?"Show all":"Show unread"}</Link></div>
 <div className="grid gap-4">{result.notifications.map(item=><article className="card" key={item.id}><div className="flex justify-between gap-4"><h2><Link href={item.href}>{item.title}</Link></h2>{!item.readAt&&<span className="badge">Unread</span>}</div><p className="hint mt-2">{formatDeadline(item.createdAt)}</p><p className="my-4">{item.body}</p><div className="flex flex-wrap gap-5"><Link className="underline" href={item.href}>View update</Link>{!item.readAt&&<MarkNotificationRead id={item.id} />}</div></article>)}{!result.notifications.length&&<p>No notifications in this view yet.</p>}</div>
 <nav aria-label="Notification pages" className="mt-6 flex gap-6">{page>1&&<Link href={"?page="+(page-1)+"&unread="+unread}>Previous</Link>}{page<result.pagination.pageCount&&<Link href={"?page="+(page+1)+"&unread="+unread}>Next</Link>}</nav></>;
}

