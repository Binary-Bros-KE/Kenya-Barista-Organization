import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getReviewApplication } from "@/server/recruitment";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return api(request,async actor=>getReviewApplication(getDb(),actor,(await context.params).id));}

