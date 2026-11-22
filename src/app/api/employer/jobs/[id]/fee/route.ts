import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { setJobFee } from "@/server/jobs";
export const dynamic = "force-dynamic";
// Administrators adjust a job's application fee before approval.
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => setJobFee(getDb(), actor, (await context.params).id, await jsonInput(request)), true);
}
