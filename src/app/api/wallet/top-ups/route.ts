import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { submitTopUp } from "@/server/wallet";
export const dynamic = "force-dynamic";
// A member's claim that they sent money by M-Pesa; an administrator confirms it.
export function POST(request: Request) { return api(request, async actor => ({ topUp: await submitTopUp(getDb(), actor, await jsonInput(request)) })); }
