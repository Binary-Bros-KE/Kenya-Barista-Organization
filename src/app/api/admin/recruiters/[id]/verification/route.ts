import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { unverifyRecruiter, verifyRecruiter } from "@/server/recruiter-requests";
export const dynamic = "force-dynamic";
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => verifyRecruiter(getDb(), actor, (await context.params).id, await jsonInput(request)), true);
}
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => unverifyRecruiter(getDb(), actor, (await context.params).id), true);
}
