import { api,jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { withdrawApplication } from "@/server/recruitment";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return api(request,async actor=>withdrawApplication(getDb(),actor,(await context.params).id,await jsonInput(request)));}

