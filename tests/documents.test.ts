import assert from "node:assert/strict";
import { test } from "node:test";
import net from "node:net";
import { validatePdf, MAX_CV_BYTES } from "../src/server/documents";
import { scanBytes } from "../src/server/cv-scanner";
test("PDF screening rejects spoofed, incomplete and oversized content",()=>{
 assert.throws(()=>validatePdf(Buffer.from("not pdf")));assert.throws(()=>validatePdf(Buffer.from("%PDF-1.7\nmissing trailer")));assert.throws(()=>validatePdf(new Uint8Array(MAX_CV_BYTES+1)));
 validatePdf(Buffer.from("%PDF-1.7\n%%EOF"));
});
test("scanner accepts only explicit complete clean or infected responses",async()=>{
 for(const [reply,expected] of [["stream: OK\0","CLEAN"],["stream: Test.Signature FOUND\0","REJECTED"],["stream: size limit exceeded ERROR\0",null],["stream: OK",null]] as const) {
  let received=Buffer.alloc(0);
  const server=net.createServer(socket=>{socket.on("data",chunk=>{received=Buffer.concat([received,chunk]);if(received.length>=10+4+3+4) socket.end(reply);});});
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  try { const port=(server.address() as net.AddressInfo).port; if(expected)assert.equal(await scanBytes(Buffer.from("pdf"),"127.0.0.1",port),expected);else await assert.rejects(scanBytes(Buffer.from("pdf"),"127.0.0.1",port));assert.equal(received.subarray(0,10).toString(),"zINSTREAM\0");assert.equal(received.readUInt32BE(10),3); }
  finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
 }
});
