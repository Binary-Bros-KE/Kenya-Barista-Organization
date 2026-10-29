import Link from "next/link";
import { notFound } from "next/navigation";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { ownApplication } from "@/server/applications";
import { AccessError } from "@/server/errors";
import { DraftForm } from "@/components/applicant-forms";
import { ApplicationResponses } from "@/components/application-responses";
import { WithdrawApplication } from "@/components/recruitment-actions";
import { applicantResponses } from "@/server/recruitment";
import { applicationStatusLabels,withdrawableStatuses } from "@/lib/application-format";
import { PaymentCheckout } from "@/components/payment-checkout";
import { paymentOptions } from "@/server/mpesa-settings";
import { paymentSummary } from "@/server/payments";
import { formatFee, formatDeadline } from "@/lib/job-format";
export default async function Page({ params,searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{responsePage?:string}> }) {
 const actor = await pageActor(); const db = getDb(); let application;
 try { application = await ownApplication(db,actor,(await params).id); } catch(e) { if(e instanceof AccessError && e.status===404) notFound(); throw e; }
 const documents = await db.document.findMany({ where: { userId: actor.user.id }, select: { id: true, filename: true, scanStatus: true } });
 const [options,summary,profile]=await Promise.all([paymentOptions(db),paymentSummary(db,actor,application.id),db.applicantProfile.findUnique({where:{userId:actor.user.id}})]);
 const payment=summary.paymentOrder; const latest=payment?.attempts[0];
 const editable=application.status==="DRAFT" && (!payment || (!payment.reviewHold && ["FAILED","CANCELLED"].includes(payment.status)));
 const rawPage=Number((await searchParams).responsePage||1),responsePage=Number.isInteger(rawPage)?Math.min(Math.max(rawPage,1),100000):1;
 const responses=await applicantResponses(db,actor,application.id,responsePage);
 const open = application.job.status==="PUBLISHED" && application.job.deadline>new Date() && !application.job.organisation.suspendedAt;
 return <><Link className="underline" href="/dashboard/applications">All applications</Link><h1 className="mt-6">{application.job.title}</h1><p className="intro">{application.job.organisation.name}</p><div className="mb-6 card"><p>Status: {applicationStatusLabels[application.status]}</p><p>Application fee: {formatFee(application.applicationFeeMinor)}</p><p>Deadline: {formatDeadline(application.job.deadline)}</p><p className="hint">Your fee is saved with this draft. Payment does not guarantee employment.</p></div>{!open && <p className="notice error mb-6">This job is currently unavailable. New payments and submissions are paused.</p>}<Link className="underline" href="/dashboard/profile">Update profile or upload a CV</Link><div className="mt-6"><DraftForm key={editable?"editable":"locked"} id={application.id} version={application.version} coverLetter={application.coverLetter} selected={application.documents[0]?.document.id || ""} documents={documents} editable={editable} /></div>{(open || payment) && <PaymentCheckout applicationId={application.id} version={application.version} amountMinor={application.applicationFeeMinor} phone={profile?.phone||""} options={open?options:[]} status={payment?.status||null} reviewHold={payment?.reviewHold||false} applicationStatus={application.status} receipt={latest?.receiptNumber||null} reviewReason={latest?.reviewReason||null} />}<ApplicationResponses result={responses} />{withdrawableStatuses.includes(application.status)&&<WithdrawApplication id={application.id} version={application.version} />}</>;
}

