import { api,jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { saveNotificationPreference } from "@/server/notification-access";
export async function GET(request:Request){return api(request,async actor=>({emailEnabled:actor.user.notificationEmails}));}
export async function PUT(request:Request){return api(request,async actor=>saveNotificationPreference(getDb(),actor,await jsonInput(request)));}

