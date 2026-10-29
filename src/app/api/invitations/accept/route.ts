import { z } from "zod";
import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { acceptInvitation } from "@/server/employers";
export function POST(request: Request) {
  return api(request, async actor => acceptInvitation(getDb(), actor, z.object({ token: z.string().max(100) }).strict().parse(await jsonInput(request)).token));
}
