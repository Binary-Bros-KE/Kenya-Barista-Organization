import { after } from "next/server";
import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { sendNotificationsNow } from "@/server/notification-worker";
import { refreshPayment } from "@/server/payments";
export const runtime="nodejs";
// A confirmed payment submits the application; its emails to the applicant and recruiter go out after the response.
export async function POST(request:Request,context:{params:Promise<{id:string}>}){after(()=>sendNotificationsNow(getDb()));return api(request,async actor=>refreshPayment(getDb(),actor,(await context.params).id));}
