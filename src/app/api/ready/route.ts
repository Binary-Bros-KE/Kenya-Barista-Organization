import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = randomUUID();
  try {
    await getDb().$queryRaw`SELECT 1`;
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    try { logEvent("error", "readiness.database_unavailable", requestId); } catch { /* invalid configuration */ }
    return Response.json({ status: "unavailable", requestId }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
