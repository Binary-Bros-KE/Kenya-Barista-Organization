import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { transitionJob } from "@/server/jobs";
export function POST(request: Request, context: { params: Promise<{ id: string }> }) { return api(request, async actor => transitionJob(getDb(), actor, (await context.params).id, await jsonInput(request))); }
