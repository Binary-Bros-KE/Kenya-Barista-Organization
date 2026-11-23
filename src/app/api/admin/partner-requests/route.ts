import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { listPartnerRequests } from "@/server/partner-requests";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return api(request, async actor => listPartnerRequests(getDb(), actor, Object.fromEntries(new URL(request.url).searchParams)), true); }
