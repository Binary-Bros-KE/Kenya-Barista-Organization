import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { createOrganisation } from "@/server/employers";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return api(request, async () => ({ organisations: await getDb().organisation.findMany({ take: 50, orderBy: { createdAt: "desc" }, select: { id: true, name: true, slug: true, suspendedAt: true, _count: { select: { members: true, jobs: true } } } }) }), true);
}
export function POST(request: Request) { return api(request, async actor => createOrganisation(getDb(), actor, await jsonInput(request)), true); }
