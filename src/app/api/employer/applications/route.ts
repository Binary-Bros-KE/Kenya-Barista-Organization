import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { listReviewApplications } from "@/server/recruitment";
export async function GET(request:Request){return api(request,actor=>listReviewApplications(getDb(),actor,Object.fromEntries(new URL(request.url).searchParams)));}

