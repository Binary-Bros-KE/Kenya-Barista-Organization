import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return api(request, async actor => ({
    user: { id: actor.user.id, name: actor.user.name, email: actor.user.email, role: actor.user.role, twoFactorEnabled: actor.user.twoFactorEnabled },
    organisations: await getDb().organisationMember.findMany({ where: { userId: actor.user.id, organisation: { suspendedAt: null } }, select: { role: true, organisation: { select: { id: true, name: true, slug: true } } } }),
  }));
}
