import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Actor } from "../src/server/access";
import { saveProfile, startApplication, saveApplication, ownApplication } from "../src/server/applications";
import { uploadCv, downloadCv, deleteCv } from "../src/server/documents";

test("private applicant drafts and CV lifecycle", { skip: process.env.RUN_DB_TESTS!=="true" || !process.env.APPLICATION_TEST_DATABASE_URL, timeout:120000 }, async t => {
 const connectionString=process.env.APPLICATION_TEST_DATABASE_URL!; const url=new URL(connectionString);
 assert.ok(["localhost","127.0.0.1","[::1]"].includes(url.hostname)); assert.notEqual(url.port,"51214");
 const db=new PrismaClient({ adapter:new PrismaPg({connectionString,max:3}) }); const suffix=randomUUID(); const ids:string[]=[];
 const previous=process.env.PRIVATE_UPLOAD_DIR; const directory=await mkdtemp(path.join(os.tmpdir(),"barista-cvs-")); process.env.PRIVATE_UPLOAD_DIR=directory;
 let organisationId=""; let jobId="";
 try {
  assert.equal(await db.application.count(),0,"Use an isolated empty application test database");
  async function actor(name:string):Promise<Actor> { const user=await db.user.create({data:{name,email:`${name}-${suffix}@example.invalid`,emailVerified:true}});ids.push(user.id);return {user,session:{id:randomUUID(),mfaVerifiedAt:null}}; }
  const owner=await actor("applicant"); const other=await actor("other");
  const organisation=await db.organisation.create({data:{name:"Test employer",slug:`applications-${suffix}`}});organisationId=organisation.id;
  const job=await db.job.create({data:{organisationId,slug:`apply-${suffix}`,title:"Barista",description:"Coffee role",location:"Nairobi",category:"BARISTA",employmentType:"FULL_TIME",status:"PUBLISHED",publishedAt:new Date(),deadline:new Date(Date.now()+86400000),applicationFeeMinor:10000}});jobId=job.id;
  await t.test("profiles validate contact details and reject privilege fields",async()=>{
   await assert.rejects(saveProfile(db,owner,{fullName:"Name",phone:"invalid",location:"Nairobi",summary:""}));
   await assert.rejects(saveProfile(db,owner,{fullName:"Name",phone:"+254712345678",location:"Nairobi",summary:"",role:"ADMIN"}));
   const profile=await saveProfile(db,owner,{fullName:"Test Applicant",phone:"+254712345678",location:"Nairobi",summary:"Coffee professional"});assert.equal(profile.userId,owner.user.id);
  });
  const app=await startApplication(db,owner,job.slug);
  await t.test("draft creation is idempotent and locks the original fee",async()=>{
   await db.job.update({where:{id:jobId},data:{applicationFeeMinor:25000}});
   const results=await Promise.all([startApplication(db,owner,job.slug),startApplication(db,owner,job.slug)]);
   assert.ok(results.every(r=>r.id===app.id && r.applicationFeeMinor===10000));assert.equal(await db.paymentOrder.count({where:{applicationId:app.id}}),0);
  });
  const pdf=Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
  let cvId="";
  await t.test("PDFs stay quarantined; unsafe names never become storage paths",async()=>{
   await assert.rejects(uploadCv(db,owner,Buffer.from("<html>fake PDF</html>"),"cv.pdf"),{code:"PDF_REQUIRED"});
   const cv=await uploadCv(db,owner,pdf,'../../my"cv.pdf');cvId=cv.id;assert.equal(cv.scanStatus,"PENDING");assert.ok(!cv.filename.includes('"'));assert.ok(!cv.filename.includes("/"));
   assert.deepEqual((await downloadCv(db,owner,cvId)).bytes,pdf);
   await assert.rejects(downloadCv(db,other,cvId),{status:404});await assert.rejects(deleteCv(db,other,cvId),{status:404});
  });
  await t.test("ownership, CV attachment, and stale saves are enforced",async()=>{
   await assert.rejects(ownApplication(db,other,app.id),{status:404});
   await assert.rejects(saveApplication(db,other,app.id,{version:1,coverLetter:"x",documentId:null}),{status:404});
   const otherCv=await uploadCv(db,other,pdf,"other.pdf");
   await assert.rejects(saveApplication(db,owner,app.id,{version:1,coverLetter:"",documentId:otherCv.id}),{status:404});
   const result=await saveApplication(db,owner,app.id,{version:1,coverLetter:"Please consider my application",documentId:cvId});assert.equal(result.version,2);
   await assert.rejects(saveApplication(db,owner,app.id,{version:1,coverLetter:"stale",documentId:null}),{code:"STALE_APPLICATION"});
   await assert.rejects(deleteCv(db,owner,cvId),{code:"CV_IN_USE"});
   assert.equal((await ownApplication(db,owner,app.id)).documents[0].document.id,cvId);
  });
  await t.test("blocked CVs cannot be downloaded or selected; final applications are immutable",async()=>{
   await db.document.update({where:{id:cvId},data:{scanStatus:"REJECTED"}});
   await assert.rejects(downloadCv(db,owner,cvId),{status:404});
   await assert.rejects(saveApplication(db,owner,app.id,{version:2,coverLetter:"",documentId:cvId}),{status:404});
   await saveApplication(db,owner,app.id,{version:2,coverLetter:"",documentId:null});
   await deleteCv(db,owner,cvId);
   await db.application.update({where:{id:app.id},data:{status:"SUBMITTED"}});
   await assert.rejects(saveApplication(db,owner,app.id,{version:3,coverLetter:"changed",documentId:null}),{code:"APPLICATION_LOCKED"});
  });
  await t.test("closed, expired, suspended and unpublished jobs reject new drafts",async()=>{
   await db.job.update({where:{id:jobId},data:{status:"CLOSED"}});await assert.rejects(startApplication(db,other,job.slug),{code:"JOB_UNAVAILABLE"});
   await db.job.update({where:{id:jobId},data:{status:"PUBLISHED",deadline:new Date(Date.now()-1000)}});await assert.rejects(startApplication(db,other,job.slug),{code:"JOB_UNAVAILABLE"});
   await db.job.update({where:{id:jobId},data:{deadline:new Date(Date.now()+86400000)}});await db.organisation.update({where:{id:organisationId},data:{suspendedAt:new Date()}});await assert.rejects(startApplication(db,other,job.slug),{code:"JOB_UNAVAILABLE"});
  });
  await t.test("storage quota is enforced during parallel uploads",async()=>{
   const outcomes=await Promise.allSettled(Array.from({length:7},()=>uploadCv(db,owner,pdf,"cv.pdf")));assert.equal(outcomes.filter(r=>r.status==="fulfilled").length,5);
   assert.equal(await db.document.count({where:{userId:owner.user.id}}),5);
  });
 } finally {
  await db.applicationDocument.deleteMany({where:{application:{userId:{in:ids}}}});await db.application.deleteMany({where:{userId:{in:ids}}});
  await db.document.deleteMany({where:{userId:{in:ids}}});await db.applicantProfile.deleteMany({where:{userId:{in:ids}}});
  if(jobId)await db.job.delete({where:{id:jobId}});if(organisationId)await db.organisation.delete({where:{id:organisationId}});await db.user.deleteMany({where:{id:{in:ids}}});await db.$disconnect();
  if(previous===undefined)delete process.env.PRIVATE_UPLOAD_DIR;else process.env.PRIVATE_UPLOAD_DIR=previous;
  await rm(directory,{recursive:true,force:true});
 }
});
