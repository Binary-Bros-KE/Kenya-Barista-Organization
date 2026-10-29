import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { listManagedJobs } from "@/server/jobs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return api(request, actor => listManagedJobs(getDb(), actor, Object.fromEntries(new URL(request.url).searchParams)), true); }
