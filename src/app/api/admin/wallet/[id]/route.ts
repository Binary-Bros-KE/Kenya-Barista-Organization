import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { reviewTopUp } from "@/server/wallet";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
// Confirm (credit the wallet) or reject a pending top-up. Processed top-ups can't change.
export function POST(request: Request, context: Context) { return api(request, async actor => reviewTopUp(getDb(), actor, (await context.params).id, await jsonInput(request))); }
