import { after } from "next/server";
import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { sendNotificationsNow } from "@/server/notification-worker";
import { payFromWallet } from "@/server/wallet";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
// Pays the application fee from the wallet and submits the application; the applicant and recruiter are emailed after the response.
export function POST(request: Request, context: Context) { after(() => sendNotificationsNow(getDb())); return api(request, async actor => payFromWallet(getDb(), actor, (await context.params).id, await jsonInput(request))); }
