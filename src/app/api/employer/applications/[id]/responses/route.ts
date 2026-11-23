import { after } from "next/server";
import { api,jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { sendNotificationsNow } from "@/server/notification-worker";
import { reviewResponses,respondToApplication } from "@/server/recruitment";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){return api(request,async actor=>reviewResponses(getDb(),actor,(await context.params).id,new URL(request.url).searchParams.get("page")||undefined));}
// The applicant is emailed about the response after it is sent.
export async function POST(request:Request,context:Context){after(()=>sendNotificationsNow(getDb()));return api(request,async actor=>respondToApplication(getDb(),actor,(await context.params).id,await jsonInput(request,32768)));}

