import { after } from "next/server";
import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { recordManualReversal } from "@/server/manual-reversals";
import { sendNotificationsNow } from "@/server/notification-worker";

// The applicant is emailed about the reversal after the response.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  after(() => sendNotificationsNow(getDb()));
  return api(request, async actor => recordManualReversal(getDb(), actor, (await context.params).id, await jsonInput(request)), true);
}
