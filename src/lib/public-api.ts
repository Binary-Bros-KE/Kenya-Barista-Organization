import "server-only";
import { ZodError } from "zod";
import { AccessError } from "../server/errors";
import { logEvent } from "./logger";
export async function publicApi(handler: () => Promise<unknown>) {
  const headers = { "Cache-Control": "no-store" };
  try { return Response.json(await handler(), { headers }); }
  catch (error) {
    if (error instanceof AccessError) return Response.json({ message: error.message, code: error.code }, { status: error.status, headers });
    if (error instanceof ZodError) return Response.json({ message: "Check your search filters and page number", code: "INVALID_SEARCH" }, { status: 400, headers });
    logEvent("error", "jobs.public_request_failed");
    return Response.json({ message: "Job listings are temporarily unavailable", code: "UNAVAILABLE" }, { status: 503, headers });
  }
}
