import { z } from "zod";
import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { startApplication } from "@/server/applications";
export async function POST(request: Request) { return api(request, async actor => {
 const { slug } = z.object({ slug: z.string().min(1).max(200) }).strict().parse(await jsonInput(request));
 const application = await startApplication(getDb(), actor, slug); return { id: application.id };
}); }

