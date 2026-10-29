import { api,jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { reviewResponses,respondToApplication } from "@/server/recruitment";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){return api(request,async actor=>reviewResponses(getDb(),actor,(await context.params).id,new URL(request.url).searchParams.get("page")||undefined));}
export async function POST(request:Request,context:Context){return api(request,async actor=>respondToApplication(getDb(),actor,(await context.params).id,await jsonInput(request,32768)));}

