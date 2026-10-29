import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { notificationOperations } from "@/server/notification-access";
export async function GET(request:Request){return api(request,actor=>notificationOperations(getDb(),actor),true);}

