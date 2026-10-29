import { publicApi } from "@/lib/public-api";
import { getDb } from "@/lib/db";
import { listPublicJobs } from "@/server/public-jobs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return publicApi(() => listPublicJobs(getDb(), Object.fromEntries(new URL(request.url).searchParams))); }
