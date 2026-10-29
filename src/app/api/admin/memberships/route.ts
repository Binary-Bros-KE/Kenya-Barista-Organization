import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return api(request, async () => ({ memberships: await getDb().organisationMember.findMany({ take: 50, orderBy: { createdAt: "desc" }, select: { id: true, role: true, organisation: { select: { name: true } }, user: { select: { name: true, email: true } } } }) }), true);
}
