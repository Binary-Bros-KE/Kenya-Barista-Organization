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
import { applicationGuidance } from "@/lib/application-view";
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
 return <div className="application-workspace"><Link className="application-back" href="/dashboard/applications">? All applications</Link>
  <header className="application-detail-heading"><div><span className="application-eyebrow">{application.job.organisation.name}</span><h1>{application.job.title}</h1></div><span className={"application-status status-"+application.status.toLowerCase()}>{applicationStatusLabels[application.status]}</span></header>
  <div className="application-guidance"><span aria-hidden="true">{application.status === "DRAFT" ? "?" : "?"}</span><div><h2>{application.status === "DRAFT" ? editable ? "Make this application yours" : "Your saved details are protected" : applicationStatusLabels[application.status]}</h2><p>{applicationGuidance(application.status, editable)}</p></div></div>
  {!open && <p className="application-warning" role="status">This job is currently unavailable. New payments and submissions are paused. Your application history is still available below.</p>}
  <dl className="application-facts"><div><dt>Application fee</dt><dd>{formatFee(application.applicationFeeMinor)}</dd></div><div><dt>Job deadline ? Nairobi time</dt><dd>{formatDeadline(application.job.deadline)}</dd></div><div><dt>Application reference</dt><dd className="application-reference">{application.id}</dd></div></dl>
  <div className="application-detail-grid"><div className="application-editor"><DraftForm key={editable?"editable":"locked"} id={application.id} version={application.version} coverLetter={application.coverLetter} selected={application.documents[0]?.document.id || ""} documents={documents} editable={editable} />
    <div className="application-profile-link"><div><strong>Keep your career toolkit ready</strong><p>Manage your professional details and upload or replace a CV.</p></div><Link href="/dashboard/profile">Profile & CVs ?</Link></div></div>
    <aside className="application-payment-panel" aria-label="Application payment and submission">{(open || payment) ? <PaymentCheckout applicationId={application.id} version={application.version} amountMinor={application.applicationFeeMinor} phone={profile?.phone||""} options={open?options:[]} status={payment?.status||null} reviewHold={payment?.reviewHold||false} applicationStatus={application.status} receipt={latest?.receiptNumber||null} reviewReason={latest?.reviewReason||null} /> : <section className="application-panel"><h2>Submissions paused</h2><p>This role is not accepting new payments or submissions.</p></section>}<p className="application-fee-note">Your fee is saved with this draft. Payment does not guarantee employment.</p></aside>
  </div>
  <ApplicationResponses result={responses} />
  {withdrawableStatuses.includes(application.status) && <WithdrawApplication id={application.id} version={application.version} />}
 </div>;
}
