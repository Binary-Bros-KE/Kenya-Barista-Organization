import { z } from "zod";
import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { setOrganisationSuspended } from "@/server/employers";
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => setOrganisationSuspended(getDb(), actor, (await context.params).id, z.object({ suspended: z.boolean() }).strict().parse(await jsonInput(request)).suspended), true);
}
