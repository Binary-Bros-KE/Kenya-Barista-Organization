import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requireOrganisation } from "@/server/access";
export const dynamic = "force-dynamic";
export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => {
    const membership = await requireOrganisation(getDb(), actor, (await context.params).id);
    return { organisation: { id: membership.organisation.id, name: membership.organisation.name, slug: membership.organisation.slug }, role: membership.role, jobCount: await getDb().job.count({ where: { organisationId: membership.organisationId } }) };
  });
}
