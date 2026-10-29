import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { recordManualReversal } from "@/server/manual-reversals";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => recordManualReversal(getDb(), actor, (await context.params).id, await jsonInput(request)), true);
}
