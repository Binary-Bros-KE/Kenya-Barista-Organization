import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { recruiterDetail } from "@/server/admin-recruiters";
export const dynamic = "force-dynamic";
export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => ({ recruiter: await recruiterDetail(getDb(), actor, (await context.params).id) }), true);
}
