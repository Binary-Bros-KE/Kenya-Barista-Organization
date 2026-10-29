import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { downloadCv, deleteCv } from "@/server/documents";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { return api(request, async actor => {
 const { document, bytes } = await downloadCv(getDb(), actor, (await context.params).id);
 return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": 'attachment; filename="' + document.filename + '"', "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Content-Length": String(bytes.length) } });
}); }
export async function DELETE(request: Request, context: Context) { return api(request, async actor => deleteCv(getDb(), actor, (await context.params).id)); }

