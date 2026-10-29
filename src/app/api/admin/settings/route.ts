import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { defaultFee, setDefaultFee } from "@/server/jobs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return api(request, async () => ({ defaultApplicationFeeMinor: await defaultFee(getDb()) }), true); }
export function PATCH(request: Request) { return api(request, async actor => setDefaultFee(getDb(), actor, await jsonInput(request)), true); }
