import { after } from "next/server";
import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { transitionJob } from "@/server/jobs";
import { sendNotificationsNow } from "@/server/notification-worker";
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  // Submitting or publishing emails the recruiter (and admins) straight away, after the response is sent.
  after(() => sendNotificationsNow(getDb()));
  return api(request, async actor => transitionJob(getDb(), actor, (await context.params).id, await jsonInput(request)));
}
