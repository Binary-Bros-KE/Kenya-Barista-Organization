import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { defaultFee } from "@/server/jobs";
export const dynamic = "force-dynamic";
// Administrators pick which recruiter a new job belongs to; recruiters always post as themselves.
export function GET(request: Request) {
  return api(request, async actor => {
    const admin = actor.user.role === "ADMIN";
    const recruiters = admin ? await getDb().user.findMany({ where: { role: "RECRUITER", status: "ACTIVE" }, select: { id: true, name: true, email: true }, take: 500, orderBy: { name: "asc" } }) : [];
    return { recruiters, defaultApplicationFeeMinor: await defaultFee(getDb()), canSetFee: admin };
  });
}
