import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { revokeInvitation } from "@/server/employers";
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => revokeInvitation(getDb(), actor, (await context.params).id), true);
}
