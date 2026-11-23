import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { saveTopUpSettings } from "@/server/wallet";
export const dynamic = "force-dynamic";
// The M-Pesa number and name members send top-ups to.
export function PUT(request: Request) { return api(request, async actor => saveTopUpSettings(getDb(), actor, await jsonInput(request))); }
