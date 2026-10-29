import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { revokeMembership } from "@/server/employers";
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => revokeMembership(getDb(), actor, (await context.params).id), true);
}
