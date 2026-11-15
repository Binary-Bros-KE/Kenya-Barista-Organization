import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { reviewRecruiterRequest } from "@/server/recruiter-requests";
export const dynamic = "force-dynamic";
// Approve or reject: { decision: "approve" | "reject", note }.
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => reviewRecruiterRequest(getDb(), actor, (await context.params).id, await jsonInput(request)), true);
}
