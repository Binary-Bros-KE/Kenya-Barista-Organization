import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { markNotificationRead } from "@/server/notification-access";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return api(request,async actor=>markNotificationRead(getDb(),actor,(await context.params).id));}

