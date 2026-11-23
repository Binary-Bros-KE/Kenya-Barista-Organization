import { after } from "next/server";
import { ZodError } from "zod";
import { jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { logEvent } from "@/lib/logger";
import { AccessError } from "@/server/errors";
import { emailPartnerRequest, submitPartnerRequest } from "@/server/partner-requests";
export const runtime = "nodejs";
// The public "Partner with us" form. No account needed; KBO is emailed after the response is sent.
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (request.headers.get("origin") !== new URL(getEnv().APP_URL).origin) throw new AccessError(403, "INVALID_ORIGIN", "Request origin is not allowed");
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const id = await submitPartnerRequest(getDb(), await jsonInput(request), ip);
    if (id) after(() => emailPartnerRequest(getDb(), id));
    return Response.json({ received: true }, { headers });
  } catch (error) {
    if (error instanceof AccessError) return Response.json({ code: error.code, message: error.message }, { status: error.status, headers });
    if (error instanceof ZodError) return Response.json({ code: "INVALID_REQUEST", message: "Check the highlighted fields and try again",
      fields: Object.fromEntries(error.issues.map(issue => [String(issue.path[0] ?? "form"), issue.message])) }, { status: 400, headers });
    logEvent("error", "partner_request.failed");
    return Response.json({ code: "UNAVAILABLE", message: "We couldn't send your request just now. Please try again, or email us." }, { status: 503, headers });
  }
}
