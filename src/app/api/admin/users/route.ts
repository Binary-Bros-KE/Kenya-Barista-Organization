import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return api(request, async () => ({ users: await getDb().user.findMany({ take: 50, orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, role: true, status: true, emailVerified: true } }) }), true);
}
