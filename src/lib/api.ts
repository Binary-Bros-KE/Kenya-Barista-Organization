import "server-only";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { getEnv } from "./env";
import { logEvent } from "./logger";
import { assertAdmin, resolveActor, type Actor } from "../server/access";
import { AccessError } from "../server/errors";

export async function jsonInput(request: Request, maxBytes = 16384): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AccessError(415, "JSON_REQUIRED", "Send a JSON request");
  const reader = request.body?.getReader();
  if (!reader) throw new AccessError(400, "INVALID_REQUEST", "Request body is required");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new AccessError(413, "REQUEST_TOO_LARGE", "Request is too large"); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AccessError(400, "INVALID_REQUEST", "Invalid JSON request"); }
}

export async function api(request: Request, handler: (actor: Actor) => Promise<unknown>, admin = false) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== new URL(getEnv().APP_URL).origin) throw new AccessError(403, "INVALID_ORIGIN", "Request origin is not allowed");
    const actor = await resolveActor(getDb(), getAuth(), request.headers);
    if (admin) assertAdmin(actor);
    const result = await handler(actor);
    if (result instanceof Response) { result.headers.set("Cache-Control", "private, no-store"); return result; }
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof AccessError) return Response.json({ code: error.code, message: error.message }, { status: error.status, headers });
    if (error instanceof ZodError) return Response.json({ code: "INVALID_REQUEST", message: "Check the supplied fields and try again" }, { status: 400, headers });
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return Response.json({ code: "CONFLICT", message: "That record already exists" }, { status: 409, headers });
    const requestId = randomUUID();
    logEvent("error", "api.request_failed", requestId);
    return Response.json({ code: "UNAVAILABLE", message: "Unable to complete this request. Please try again.", requestId }, { status: 503, headers });
  }
}
