import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { listTopUps } from "@/server/wallet";
export const dynamic = "force-dynamic";
// Top-up claims for administrators, by status.
export function GET(request: Request) { return api(request, actor => listTopUps(getDb(), actor, Object.fromEntries(new URL(request.url).searchParams))); }
