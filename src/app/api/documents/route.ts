import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { MAX_CV_BYTES, uploadCv } from "@/server/documents";
import { AccessError } from "@/server/errors";
export const runtime = "nodejs";
export async function POST(request: Request) { return api(request, async actor => {
 if (request.headers.get("content-type")?.split(";")[0] !== "application/pdf") throw new AccessError(415, "PDF_REQUIRED", "Upload a PDF CV");
 const reader = request.body?.getReader(); if (!reader) throw new AccessError(400, "EMPTY_FILE", "Choose a PDF");
 let size = 0; const chunks: Uint8Array[] = [];
 while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_CV_BYTES) { await reader.cancel(); throw new AccessError(413, "INVALID_SIZE", "Upload a PDF up to 5 MB"); } chunks.push(value); }
 return uploadCv(getDb(), actor, Buffer.concat(chunks), request.headers.get("x-filename") || "cv.pdf");
}); }

