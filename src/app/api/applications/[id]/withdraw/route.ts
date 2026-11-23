import { after } from "next/server";
import { api,jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { sendNotificationsNow } from "@/server/notification-worker";
import { withdrawApplication } from "@/server/recruitment";
// The recruiter is emailed about the withdrawal after the response.
export async function POST(request:Request,context:{params:Promise<{id:string}>}){after(()=>sendNotificationsNow(getDb()));return api(request,async actor=>withdrawApplication(getDb(),actor,(await context.params).id,await jsonInput(request)));}

