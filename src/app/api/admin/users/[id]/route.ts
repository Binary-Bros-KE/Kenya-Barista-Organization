import { z } from "zod";
import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { setUserSuspended } from "@/server/employers";
import { accountDetail } from "@/server/admin-accounts";
export const dynamic = "force-dynamic";
export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => ({ account: await accountDetail(getDb(), actor, (await context.params).id) }), true);
}
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => setUserSuspended(getDb(), actor, (await context.params).id, z.object({ suspended: z.boolean() }).strict().parse(await jsonInput(request)).suspended), true);
}
