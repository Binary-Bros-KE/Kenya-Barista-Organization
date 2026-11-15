import Link from "next/link";
import type { ReactNode } from "react";
import type { DashboardOverviewData } from "@/server/dashboard-overview";
import { applicationStatusLabels } from "@/lib/application-format";
import { formatDeadline, statusLabels } from "@/lib/job-format";
import { VerifiedBadge } from "./verified-badge";

type IconName = "applications" | "people" | "briefcase" | "bell" | "check" | "shield" | "arrow" | "profile" | "calendar" | "clock" | "building" | "money" | "alert";
type Stat = { label: string; value: string; hint: string; href: string; icon: IconName; color: "teal" | "rose" | "gold" | "green" };
function OverviewIcon({ name }: { name: IconName }) {
  const shapes: Record<IconName, ReactNode> = {
    applications: <><path d="M7 3H4v18h16V3h-3" /><rect x="7" y="2" width="10" height="5" rx="1" /><path d="M8 12h8M8 16h5" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V3h8v4M3 12a20 20 0 0 0 18 0M10 13h4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    shield: <><path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Z" /><path d="m8 11 3 3 5-5" /></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6M17 2v6M3 11h18M7 15h2M13 15h2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    building: <><path d="M4 21V5h10v16M14 10h6v11M2 21h20M8 9h2M8 13h2M8 17h2M17 14h1M17 18h1" /></>,
    money: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v5M18 9.5v5" /></>,
    alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name]}</svg>;
}
type User = { name: string | null; email: string; role: "ADMIN" | "RECRUITER" | "APPLICANT"; emailVerified: boolean; twoFactorEnabled: boolean };

export function DashboardOverview({ data, user, now = new Date() }: { data: DashboardOverviewData; user: User; now?: Date }) {
  const admin = user.role === "ADMIN", platform = data.platform, recruiting = admin ? null : data.recruiting;
  const action = { href: "/jobs", label: "Explore opportunities" };
  const count = (value: number | undefined) => value === undefined ? "—" : new Intl.NumberFormat("en-KE").format(value);
  const stats: Stat[] = admin ? [
    { label: "Verified members", value: count(platform?.members), hint: "Accounts with a confirmed email", href: "/admin/accounts?status=verified", icon: "people", color: "teal" },
    { label: "Active recruiters", value: count(platform?.recruiters), hint: "Accounts that can post jobs", href: "/admin", icon: "building", color: "rose" },
    { label: "Live jobs", value: count(platform?.liveJobs), hint: "Published on the jobs page", href: "/jobs", icon: "briefcase", color: "gold" },
    { label: "Awaiting review", value: count(platform?.pendingJobs), hint: "Postings waiting for your decision", href: "/admin/jobs", icon: "clock", color: "green" },
  ] : recruiting ? [
    { label: "Live jobs", value: count(recruiting.liveJobs), hint: "Open for applications now", href: "/employer/jobs", icon: "briefcase", color: "teal" },
    { label: "New applicants", value: count(recruiting.newApplicants), hint: "Waiting for your first look", href: "/employer/applications?status=SUBMITTED", icon: "applications", color: "rose" },
    { label: "Awaiting approval", value: count(recruiting.awaitingApproval), hint: "Jobs with KBO for review", href: "/employer/jobs", icon: "clock", color: "gold" },
    { label: "Changes requested", value: count(recruiting.changesRequested), hint: "Jobs KBO sent back to you", href: "/employer/jobs", icon: "alert", color: "green" },
  ] : [
    { label: "Your applications", value: count(data.counts.applications), hint: "Including saved drafts", href: "/dashboard/applications", icon: "applications", color: "teal" },
    { label: "In progress", value: count(data.counts.active), hint: "Submitted, in review or shortlisted", href: "/dashboard/applications", icon: "briefcase", color: "rose" },
    { label: "Saved drafts", value: count(data.counts.drafts), hint: "Applications you can return to", href: "/dashboard/applications", icon: "clock", color: "gold" },
    { label: "Unread updates", value: count(data.counts.unread), hint: "Updates in your notification inbox", href: "/dashboard/notifications?unread=true", icon: "bell", color: "green" },
  ];
  const steps = [
    { title: "Email verified", hint: "Your sign-in address is confirmed", ready: user.emailVerified, href: "/dashboard/security" },
    { title: "Profile essentials", hint: "Name, mobile number and location", ready: data.profileReady, href: "/dashboard/profile" },
    { title: "CV screening", hint: data.cleanCvs ? `${data.cleanCvs} CV${data.cleanCvs === 1 ? " has" : "s have"} passed screening` : "Upload a PDF CV for screening", ready: data.cleanCvs > 0, href: "/dashboard/profile" },
  ];
  const completed = steps.filter(step => step.ready).length;
  const quickLinks = recruiting ? [
    { title: "Post a job", text: "Create a new opening for KBO to approve", href: "/employer/jobs/new", icon: "briefcase" as const },
    { title: "Review applicants", text: "Every paid application to your jobs", href: "/employer/applications", icon: "applications" as const },
        { title: "Profile and CVs", text: "Your own job-seeker profile", href: "/dashboard/profile", icon: "profile" as const },
  ] : admin ? [
    { title: "Accounts", text: "Every member, their activity and applications", href: "/admin/accounts", icon: "people" as const },
    { title: "Recruiters", text: "Recruiter accounts, their jobs and applicants", href: "/admin", icon: "building" as const },
    { title: "Applicants", text: "Paid applications across all employers", href: "/employer/applications", icon: "applications" as const },
    { title: "Payments", text: "M-Pesa settings and payment history", href: "/admin/payments", icon: "money" as const },
    { title: "Delivery queue", text: "Failed emails and notification retries", href: "/admin/notifications", icon: "bell" as const },
  ] : [
    { title: "Profile and CVs", text: "Keep your professional details ready", href: "/dashboard/profile", icon: "profile" as const },
    { title: "Payments", text: "Application fees and receipts", href: "/dashboard/payments", icon: "applications" as const },
    { title: "Become a recruiter", text: data.recruiterRequest?.status === "PENDING" ? "Your request is being reviewed by KBO" : data.recruiterRequest?.status === "REJECTED" ? "See why and apply again" : "Hiring? Post jobs through KBO", href: "/dashboard/recruiter-request", icon: "briefcase" as const },
    { title: "Security", text: user.twoFactorEnabled ? "Manage your sign-in protection" : "Add optional two-factor protection", href: "/dashboard/security", icon: "shield" as const },
  ];
  const hour = Number(new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user.name || "").trim().split(/\s+/)[0];

  return <div className="overview">
    <h1 className="overview-sr-only">{admin ? "Dashboard" : "My account"}</h1>
    <div className="overview-greeting"><p>{greeting}{firstName ? `, ${firstName}` : ""}.{recruiting && (data.recruiterVerified ? <> <VerifiedBadge /></> : <> <span className="overview-unverified" title="KBO will contact you to confirm your details. Verified recruiters get a badge on their jobs.">Verification pending</span></>)}</p><time dateTime={now.toISOString()}><OverviewIcon name="calendar" />{new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)}</time></div>

    <section className="overview-stats" aria-label={admin ? "Platform at a glance" : recruiting ? "Recruiting at a glance" : "Your activity"}>{stats.map(card => <Link className={`overview-stat overview-stat-${card.color}`} href={card.href} key={card.label} aria-label={`${card.label}: ${card.value}`}><span className="overview-stat-icon"><OverviewIcon name={card.icon} /></span><span className="overview-stat-label">{card.label}</span><strong>{card.value}</strong><span className="overview-stat-hint">{card.hint}<OverviewIcon name="arrow" /></span><span className="overview-stat-mark" aria-hidden="true"><OverviewIcon name={card.icon} /></span></Link>)}</section>

    {!admin && !recruiting && <section className="overview-welcome" aria-labelledby="overview-welcome-title"><div className="overview-welcome-copy"><span className="overview-role">Coffee professional</span><h2 id="overview-welcome-title">Welcome back, {user.name || "coffee professional"}.</h2><p>Keep your profile ready, follow your applications and find your next opportunity.</p><Link className="overview-primary-link" href={action.href}>{action.label}<OverviewIcon name="arrow" /></Link></div><div className="overview-coffee-art" aria-hidden="true"><svg viewBox="0 0 200 180" fill="none"><circle cx="105" cy="90" r="75" stroke="currentColor" strokeOpacity=".15" /><circle cx="105" cy="90" r="57" stroke="currentColor" strokeOpacity=".12" /><path d="M59 72h83v39c0 23-18 40-41 40s-42-17-42-40V72Z" stroke="currentColor" strokeWidth="2" /><path d="M142 80h9c24 0 24 35 0 35h-10M45 157h111M83 57c-14-16 15-19 1-36M106 57c-14-16 15-19 1-36M127 57c-14-16 15-19 1-36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></div></section>}

    <div className="overview-grid"><section className="overview-panel overview-recent" aria-labelledby="overview-recent-title"><div className="overview-panel-heading"><div><h2 id="overview-recent-title">{admin ? "Jobs awaiting review" : recruiting ? "Latest applicants" : "Recent applications"}</h2><p>{admin ? "The next postings ready for your attention." : recruiting ? "The newest paid applications to your jobs." : "Pick up where you left off."}</p></div><Link href={admin ? "/admin/jobs" : recruiting ? "/employer/applications" : "/dashboard/applications"} className="overview-text-link">View all<OverviewIcon name="arrow" /></Link></div>
      {admin ? !platform?.jobs.length ? <EmptyState icon="check" title="The review queue is clear" text="New job postings will appear here when employers submit them for review." /> : <ul className="overview-rows">{platform.jobs.map(job => <li key={job.id}><Link href={`/admin/jobs/${job.id}`} className="overview-record"><span className="overview-company-mark" aria-hidden="true">{job.employer.charAt(0).toUpperCase()}</span><span className="overview-record-copy"><strong>{job.title}</strong><span>{job.employer}</span><time dateTime={job.updatedAt.toISOString()}>{formatDeadline(job.updatedAt)}</time></span><span className="overview-status overview-status-pending">Awaiting review</span></Link></li>)}</ul>
      : recruiting ? !recruiting.applicants.length ? <EmptyState icon="applications" title="No applicants yet" text="Paid applications to your live jobs will appear here." href="/employer/jobs" label="View your jobs" /> : <ul className="overview-rows">{recruiting.applicants.map(applicant => <li key={applicant.id}><Link href={`/employer/applications/${applicant.id}`} className="overview-record"><span className="overview-company-mark" aria-hidden="true">{applicant.name.charAt(0).toUpperCase()}</span><span className="overview-record-copy"><strong>{applicant.name}</strong><span>{applicant.title}</span>{applicant.submittedAt && <time dateTime={applicant.submittedAt.toISOString()}>{formatDeadline(applicant.submittedAt)}</time>}</span><span className={`overview-status overview-status-${applicant.status.toLowerCase()}`}>{applicationStatusLabels[applicant.status]}</span></Link></li>)}</ul>
      : !data.applications.length ? <EmptyState icon="briefcase" title="No applications yet" text="Explore coffee and hospitality opportunities, then save your first application." href="/jobs" label="Browse jobs" /> : <ul className="overview-rows">{data.applications.map(application => <li key={application.id}><Link href={`/dashboard/applications/${application.id}`} className="overview-record"><span className="overview-company-mark" aria-hidden="true">{application.employer.charAt(0).toUpperCase()}</span><span className="overview-record-copy"><strong>{application.title}</strong><span>{application.employer}</span><time dateTime={application.updatedAt.toISOString()}>{formatDeadline(application.updatedAt)}</time></span><span className={`overview-status overview-status-${application.status.toLowerCase()}`}>{applicationStatusLabels[application.status]}</span></Link></li>)}</ul>}
    </section>

    {recruiting && <section className="overview-panel" aria-labelledby="overview-jobs-title"><div className="overview-panel-heading"><div><h2 id="overview-jobs-title">Jobs needing attention</h2><p>Drafts, jobs with KBO, and jobs sent back to you.</p></div><Link className="overview-text-link" href="/employer/jobs">View all<OverviewIcon name="arrow" /></Link></div>{!recruiting.jobs.length ? <EmptyState icon="check" title="All caught up" text="No drafts or jobs waiting on anyone." href="/employer/jobs/new" label="Post a job" /> : <ul className="overview-updates">{recruiting.jobs.map(job => <li key={job.id}><Link href={`/employer/jobs/${job.id}`}><span className={`overview-job-dot is-${job.status.toLowerCase()}`} aria-hidden="true" /><span><strong>{job.title}</strong><time dateTime={job.updatedAt.toISOString()}>{statusLabels[job.status]}</time></span><OverviewIcon name="arrow" /></Link></li>)}</ul>}</section>}

    {!admin && !recruiting && <section className="overview-panel" aria-labelledby="overview-checklist-title"><div className="overview-panel-heading"><div><h2 id="overview-checklist-title">Account essentials</h2><p>Get the essentials ready before applying.</p></div><span className="overview-checklist-count">{completed}/3</span></div><div className="overview-progress" role="progressbar" aria-label="Account essentials checklist" aria-valuemin={0} aria-valuemax={3} aria-valuenow={completed}><span style={{ width: `${completed / 3 * 100}%` }} /></div><ul className="overview-checklist">{steps.map(step => <li key={step.title}><Link href={step.href}><span className={`overview-step-icon${step.ready ? " is-complete" : ""}`} aria-label={step.ready ? "Complete" : "To do"}><OverviewIcon name={step.ready ? "check" : "arrow"} /></span><span><strong>{step.title}</strong><span>{step.hint}</span></span></Link></li>)}</ul><div className="overview-email"><span>Signed in with</span><strong>{user.email}</strong></div></section>}

    <section className="overview-panel" aria-labelledby="overview-updates-title"><div className="overview-panel-heading"><div><h2 id="overview-updates-title">Latest updates</h2><p>{data.counts.unread ? `${data.counts.unread} unread update${data.counts.unread === 1 ? "" : "s"}` : "Your latest notifications and responses."}</p></div><Link className="overview-text-link" href="/dashboard/notifications">View all<OverviewIcon name="arrow" /></Link></div>{!data.notifications.length ? <EmptyState icon="bell" title="No updates yet" text={admin ? "Platform alerts will appear here." : "Application responses and account updates will appear here."} /> : <ul className="overview-updates">{data.notifications.map(notification => <li key={notification.id}><Link href={notification.href}><span className={`overview-update-dot${!notification.readAt ? " is-unread" : ""}`} aria-label={!notification.readAt ? "Unread" : "Read"} /><span><strong>{notification.title}</strong><time dateTime={notification.createdAt.toISOString()}>{formatDeadline(notification.createdAt)}</time></span><OverviewIcon name="arrow" /></Link></li>)}</ul>}</section>

    <section className="overview-panel" aria-labelledby="overview-shortcuts-title"><div className="overview-panel-heading"><div><h2 id="overview-shortcuts-title">Quick access</h2><p>A shorter route to the things you need.</p></div></div><ul className="overview-shortcuts">{quickLinks.map(link => <li key={link.title}><Link href={link.href}><span className="overview-shortcut-icon"><OverviewIcon name={link.icon} /></span><span><strong>{link.title}</strong><span>{link.text}</span></span><OverviewIcon name="arrow" /></Link></li>)}</ul></section></div>
  </div>;
}

function EmptyState({ icon, title, text, href, label }: { icon: IconName; title: string; text: string; href?: string; label?: string }) {
  return <div className="overview-empty"><span className="overview-empty-icon"><OverviewIcon name={icon} /></span><h3>{title}</h3><p>{text}</p>{href && <Link className="overview-text-link" href={href}>{label}<OverviewIcon name="arrow" /></Link>}</div>;
}
