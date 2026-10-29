import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { saveApplication } from "@/server/applications";
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) { return api(request, async actor => saveApplication(getDb(), actor, (await context.params).id, await jsonInput(request, 32768))); }

