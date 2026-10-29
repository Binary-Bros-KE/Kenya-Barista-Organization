import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getManagedJob, updateJob } from "@/server/jobs";
export const dynamic = "force-dynamic";
export function GET(request: Request, context: { params: Promise<{ id: string }> }) { return api(request, async actor => getManagedJob(getDb(), actor, (await context.params).id)); }
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return api(request, async actor => updateJob(getDb(), actor, (await context.params).id, await jsonInput(request, 65536))); }
