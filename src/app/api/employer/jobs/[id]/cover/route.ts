import { z } from "zod";
import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { readImageBody } from "@/server/images";
import { removeJobCover, setJobCover } from "@/server/jobs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A job's cover photo. The body is the raw image file; ?version= is the job version the editor last loaded.
const version = (request: Request) => z.coerce.number().int().positive().parse(new URL(request.url).searchParams.get("version"));
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => setJobCover(getDb(), actor, (await context.params).id, version(request), await readImageBody(request, "job-covers")));
}
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => removeJobCover(getDb(), actor, (await context.params).id, version(request)));
}
