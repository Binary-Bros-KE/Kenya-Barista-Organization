import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { logEvent } from "@/lib/logger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  try {
    const handlers = toNextJsHandler(getAuth());
    const response = await (request.method === "GET" ? handlers.GET(request) : handlers.POST(request));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    logEvent("error", "auth.request_failed");
    return Response.json({ message: "Account services are unavailable. Check the local database and authentication setup." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
export const GET = handle;
export const POST = handle;
