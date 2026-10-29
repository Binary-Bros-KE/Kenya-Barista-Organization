import { publicApi } from "@/lib/public-api";
import { getDb } from "@/lib/db";
import { getPublicJob } from "@/server/public-jobs";
export const dynamic = "force-dynamic";
export function GET(_request: Request, context: { params: Promise<{ slug: string }> }) { return publicApi(async () => getPublicJob(getDb(), (await context.params).slug)); }
