import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { payFromWallet } from "@/server/wallet";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
// Pays the application fee from the wallet and submits the application.
export function POST(request: Request, context: Context) { return api(request, async actor => payFromWallet(getDb(), actor, (await context.params).id, await jsonInput(request))); }
