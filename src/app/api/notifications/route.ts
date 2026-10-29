import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { listNotifications } from "@/server/notification-access";
export async function GET(request:Request){return api(request,actor=>listNotifications(getDb(),actor,Object.fromEntries(new URL(request.url).searchParams)));}

