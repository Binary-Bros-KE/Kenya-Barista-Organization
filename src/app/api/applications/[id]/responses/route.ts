import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { applicantResponses } from "@/server/recruitment";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return api(request,async actor=>applicantResponses(getDb(),actor,(await context.params).id,new URL(request.url).searchParams.get("page")||undefined));}

