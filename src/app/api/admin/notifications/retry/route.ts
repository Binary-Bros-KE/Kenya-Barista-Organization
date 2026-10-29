import { api,jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { retryNotificationWork } from "@/server/notification-access";
export async function POST(request:Request){return api(request,async actor=>retryNotificationWork(getDb(),actor,await jsonInput(request)),true);}

