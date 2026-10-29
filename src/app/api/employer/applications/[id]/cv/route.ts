import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { downloadReviewCv } from "@/server/recruitment";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return api(request,async actor=>{
 const {bytes,filename}=await downloadReviewCv(getDb(),actor,(await context.params).id);
 return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/octet-stream","Content-Disposition":'attachment; filename="'+filename.replace(/[^a-zA-Z0-9 ._-]/g,"_")+'"',"X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox","Content-Length":String(bytes.length)}});
});}

