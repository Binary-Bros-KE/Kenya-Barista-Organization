import Link from "next/link";
import { SecurityMark } from "@/components/security-mark";
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
import { WalletPay } from "@/components/wallet";
import { walletBalance } from "@/server/wallet";
import { paymentOptions } from "@/server/mpesa-settings";
import { paymentSummary } from "@/server/payments";
import { applicationGuidance } from "@/lib/application-view";
import { formatFee, formatDeadline } from "@/lib/job-format";
import { asEmployer } from "@/lib/employer";
export default async function Page({ params,searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{responsePage?:string}> }) {
 const actor = await pageActor(); const db = getDb(); let application;
 try { application = await ownApplication(db,actor,(await params).id); } catch(e) { if(e instanceof AccessError && e.status===404) notFound(); throw e; }
 // The current CV, plus an older one this application already has (a replaced CV stays with applications already sent).
 const documents = await db.document.findMany({ where: { userId: actor.user.id, OR: [{ retiredAt: null }, { applications: { some: { applicationId: application.id } } }] }, select: { id: true, filename: true, scanStatus: true } });
 const [options,summary,profile,balance]=await Promise.all([paymentOptions(db),paymentSummary(db,actor,application.id),db.applicantProfile.findUnique({where:{userId:actor.user.id}}),walletBalance(db,actor)]);
 const payment=summary.paymentOrder; const latest=payment?.attempts[0];
 const editable=application.status==="DRAFT" && (!payment || (!payment.reviewHold && ["FAILED","CANCELLED"].includes(payment.status)));
 const rawPage=Number((await searchParams).responsePage||1),responsePage=Number.isInteger(rawPage)?Math.min(Math.max(rawPage,1),100000):1;
 const responses=await applicantResponses(db,actor,application.id,responsePage);
 const employer = asEmployer(application.job.recruiter);
 const open = application.job.status==="PUBLISHED" && application.job.deadline>new Date() && application.job.recruiter.status === "ACTIVE";
 return <div className="application-workspace"><Link className="application-back" href="/dashboard/applications">&larr; All applications</Link>
  <header className="application-detail-heading"><div><span className="application-eyebrow">{employer.name || "KBO recruiter"}</span><h1>{application.job.title}</h1></div><span className={"application-status status-"+application.status.toLowerCase()}>{applicationStatusLabels[application.status]}</span></header>
  {/* A draft explains itself through the form and payment panel; other stages say what happens next. */}
  {!(application.status === "DRAFT" && editable) && <div className="application-guidance"><span aria-hidden="true"><SecurityMark/></span><div><h2>{application.status === "DRAFT" ? editable ? "Make this application yours" : "Your saved details are protected" : applicationStatusLabels[application.status]}</h2><p>{applicationGuidance(application.status, editable)}</p></div></div>}
  {!open && <p className="application-warning" role="status">This job is currently unavailable. New payments and submissions are paused. Your application history is still available below.</p>}
  <dl className="application-facts"><div className="is-fee"><span className="application-fact-icon" aria-hidden="true">KES</span><dt>Application fee</dt><dd>{formatFee(application.applicationFeeMinor)}</dd></div><div className="is-deadline"><span className="application-fact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><dt>Job deadline &middot; Nairobi time</dt><dd>{formatDeadline(application.job.deadline)}</dd></div><div className="is-reference"><span className="application-fact-icon" aria-hidden="true">#</span><dt>Application reference</dt><dd className="application-reference">{application.id}</dd></div></dl>
  <div className="application-detail-grid"><div className="application-editor"><DraftForm key={editable?"editable":"locked"} id={application.id} version={application.version} coverLetter={application.coverLetter} selected={application.documents[0]?.document.id || ""} documents={documents} editable={editable} /></div>
    <aside className="application-payment-panel" aria-label="Application payment and submission">{open && editable && <WalletPay applicationId={application.id} version={application.version} feeMinor={application.applicationFeeMinor} balanceMinor={balance} />}{(payment || (open && options.length > 0)) ? <PaymentCheckout applicationId={application.id} version={application.version} amountMinor={application.applicationFeeMinor} phone={profile?.phone||""} options={open?options:[]} status={payment?.status||null} reviewHold={payment?.reviewHold||false} applicationStatus={application.status} receipt={latest?.receiptNumber||null} reviewReason={latest?.reviewReason||null} /> : !open && <section className="application-panel"><h2>Submissions paused</h2><p>This role is not accepting new payments or submissions.</p></section>}<p className="application-fee-note">Your fee is saved with this draft. Payment does not guarantee employment.</p></aside>
  </div>
  <ApplicationResponses result={responses} />
  {withdrawableStatuses.includes(application.status) && <WithdrawApplication id={application.id} version={application.version} />}
  <div className="application-profile-link"><span className="application-profile-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg></span><div><strong>Keep your career toolkit ready</strong><p>Manage your professional details and upload or replace a CV.</p></div><Link href="/dashboard/profile">Profile &amp; CVs &#8594;</Link></div>
 </div>;
}
