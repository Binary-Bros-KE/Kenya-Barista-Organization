import net from "node:net";
import { createHash } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client";
import { readStoredCv } from "./documents";

// ClamAV INSTREAM protocol: https://docs.clamav.net/manual/Usage/ClamdProtocol.html
export function scanBytes(bytes: Uint8Array, host = process.env.CLAMAV_HOST || "127.0.0.1", port = Number(process.env.CLAMAV_PORT || 3310)): Promise<"CLEAN" | "REJECTED"> {
  return new Promise((resolve,reject) => {
    const socket = net.createConnection({ host, port }); let reply = ""; let finished = false;
    const finish = (error?: Error, result?: "CLEAN" | "REJECTED") => { if (finished) return; finished = true; socket.destroy(); if(error) reject(error); else resolve(result!); };
    socket.setTimeout(15000, () => finish(new Error("Scanner timed out")));
    socket.on("error", () => finish(new Error("Scanner unavailable")));
    socket.on("end", () => { if(!finished) finish(new Error("Incomplete scanner response")); });
    socket.on("connect", () => {
      socket.write(Buffer.from("zINSTREAM\0"));
      for(let offset=0;offset<bytes.length;offset+=65536) { const chunk=bytes.subarray(offset,offset+65536); const length=Buffer.alloc(4); length.writeUInt32BE(chunk.length); socket.write(length); socket.write(chunk); }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", chunk => {
      reply += chunk.toString("utf8"); if(reply.length>4096) return finish(new Error("Invalid scanner response"));
      const end=reply.indexOf("\0"); if(end<0) return;
      const response=reply.slice(0,end);
      if(response==="stream: OK") finish(undefined,"CLEAN");
      else if(/^stream: .+ FOUND$/.test(response)) finish(undefined,"REJECTED");
      else finish(new Error("Scanner did not complete successfully"));
    });
  });
}
export async function scanPendingCvs(db: PrismaClient) {
  const documents = await db.document.findMany({ where: { scanStatus: "PENDING" }, orderBy: { createdAt: "asc" }, take: 50 });
  let processed=0;
  for (const document of documents) {
    const bytes = await readStoredCv(document.storageKey);
    const digest=createHash("sha256").update(bytes).digest("hex");
    const status = document.sha256 && digest===document.sha256 ? await scanBytes(bytes) : "REJECTED";
    const result=await db.document.updateMany({ where: { id: document.id, scanStatus: "PENDING", sha256: document.sha256 }, data: { scanStatus: status } });
    processed+=result.count;
  }
  return { processed };
}
