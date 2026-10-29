import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { assertAdmin } from "@/server/access";
import { defaultFee } from "@/server/jobs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return api(request, async actor => {
    if (actor.user.role === "ADMIN") assertAdmin(actor);
    const organisations = await getDb().organisation.findMany({ where: { suspendedAt: null, ...(actor.user.role !== "ADMIN" ? { members: { some: { userId: actor.user.id } } } : {}) }, select: { id: true, name: true }, take: 200, orderBy: { name: "asc" } });
    return { organisations, defaultApplicationFeeMinor: await defaultFee(getDb()), canSetFee: actor.user.role === "ADMIN" };
  });
}
