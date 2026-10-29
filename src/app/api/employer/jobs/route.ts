import { z } from "zod";
import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { createJob, listManagedJobs } from "@/server/jobs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return api(request, actor => listManagedJobs(getDb(), actor, Object.fromEntries(new URL(request.url).searchParams))); }
export function POST(request: Request) {
  return api(request, async actor => {
    const { organisationId, job } = z.object({ organisationId: z.string().min(1).max(100), job: z.unknown() }).strict().parse(await jsonInput(request, 65536));
    return createJob(getDb(), actor, organisationId, job);
  });
}
