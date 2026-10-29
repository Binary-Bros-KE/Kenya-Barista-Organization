import Link from "next/link";
import type { ReactNode } from "react";
import type { DashboardOverviewData } from "@/server/dashboard-overview";
import { applicationStatusLabels } from "@/lib/application-format";
import { formatDeadline } from "@/lib/job-format";

type IconName = "applications" | "people" | "briefcase" | "bell" | "check" | "shield" | "arrow" | "profile" | "calendar" | "clock";
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
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name]}</svg>;
}
type User = { name: string | null; email: string; role: "ADMIN" | "APPLICANT"; emailVerified: boolean; twoFactorEnabled: boolean };

export function DashboardOverview({ data, user, now = new Date() }: { data: DashboardOverviewData; user: User; now?: Date }) {
  const admin = user.role === "ADMIN", locked = admin && !data.adminVerified;
  const action = admin ? { href: locked ? "/dashboard/security" : "/admin", label: locked ? "Verify admin access" : "Open administration" }
    : data.memberships ? { href: "/employer/jobs", label: "Manage job postings" } : { href: "/jobs", label: "Explore opportunities" };
  const metrics: { label: string; value: number | null; hint: string; href: string; icon: IconName; tone: string }[] = admin ? [
    { label: "Verified members", value: data.platform?.members ?? null, hint: "Active, verified accounts", href: "/admin", icon: "people", tone: "sand" },
    { label: "Active organisations", value: data.platform?.organisations ?? null, hint: "Employers on the platform", href: "/admin", icon: "briefcase", tone: "sage" },
    { label: "Awaiting review", value: data.platform?.pendingJobs ?? null, hint: "Job postings ready for review", href: "/admin/jobs", icon: "clock", tone: "clay" },
    { label: "Submitted applications", value: data.platform?.submissions ?? null, hint: "Confirmed paid submissions", href: "/employer/applications", icon: "applications", tone: "stone" },
  ] : [
    { label: "Your applications", value: data.counts.applications, hint: "Including saved drafts", href: "/dashboard/applications", icon: "applications", tone: "sand" },
    { label: "In progress", value: data.counts.active, hint: "Submitted, in review or shortlisted", href: "/dashboard/applications", icon: "briefcase", tone: "sage" },
    { label: "Saved drafts", value: data.counts.drafts, hint: "Applications you can return to", href: "/dashboard/applications", icon: "clock", tone: "clay" },
    { label: "Unread updates", value: data.counts.unread, hint: "Updates in your notification inbox", href: "/dashboard/notifications?unread=true", icon: "bell", tone: "stone" },
  ];
  const steps = admin ? [
    { title: "Email verified", hint: "Your sign-in address is confirmed", ready: user.emailVerified, href: "/dashboard/security" },
    { title: "Authenticator enabled", hint: "Required for administrator access", ready: user.twoFactorEnabled, href: "/dashboard/security" },
    { title: "Session verified", hint: "Complete 2FA for this sign-in", ready: data.adminVerified, href: "/dashboard/security" },
  ] : [
    { title: "Email verified", hint: "Your sign-in address is confirmed", ready: user.emailVerified, href: "/dashboard/security" },
    { title: "Profile essentials", hint: "Name, mobile number and location", ready: data.profileReady, href: "/dashboard/profile" },
    { title: "CV screening", hint: data.cleanCvs ? `${data.cleanCvs} CV${data.cleanCvs === 1 ? " has" : "s have"} passed screening` : "Upload a PDF CV for screening", ready: data.cleanCvs > 0, href: "/dashboard/profile" },
  ];
  const completed = steps.filter(step => step.ready).length;
  const quickLinks = [
    ...(admin ? [{ title: "Administration", text: "Organisations, employers and accounts", href: locked ? "/dashboard/security" : "/admin", icon: "people" as const }]
      : [{ title: "Profile and CVs", text: "Keep your professional details ready", href: "/dashboard/profile", icon: "profile" as const }]),
    ...(data.memberships && !admin ? [{ title: "Employer workspace", text: "Manage postings and review applicants", href: "/employer", icon: "briefcase" as const }] : []),
    { title: "Payments", text: "Application fees and receipts", href: "/dashboard/payments", icon: "applications" as const },
    { title: "Security", text: user.twoFactorEnabled ? "Manage your sign-in protection" : admin ? "Set up required two-factor authentication" : "Add optional two-factor protection", href: "/dashboard/security", icon: "shield" as const },
  ];

  return <div className="overview">
    <div className="overview-heading"><div><p className="overview-eyebrow">Your workspace</p><h1>Overview</h1><p className="overview-subtitle">{admin ? "Your community, account and next steps in one place." : "A little clarity for your next career move."}</p></div><time className="overview-date" dateTime={now.toISOString()}><OverviewIcon name="calendar" />{new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", dateStyle: "long" }).format(now)}</time></div>

    <section className="overview-welcome" aria-labelledby="overview-welcome-title"><div className="overview-welcome-copy"><span className="overview-role">{admin ? "Administrator" : data.memberships ? "Employer & member" : "Coffee professional"}</span><h2 id="overview-welcome-title">Welcome back, {user.name || "coffee professional"}.</h2><p>{admin ? "Review job postings, support employers and keep your community moving." : "Keep your profile ready, follow your applications and find your next opportunity."}</p><Link className="overview-primary-link" href={action.href}>{action.label}<OverviewIcon name="arrow" /></Link></div><div className="overview-coffee-art" aria-hidden="true"><svg viewBox="0 0 200 180" fill="none"><circle cx="105" cy="90" r="75" stroke="currentColor" strokeOpacity=".15" /><circle cx="105" cy="90" r="57" stroke="currentColor" strokeOpacity=".12" /><path d="M59 72h83v39c0 23-18 40-41 40s-42-17-42-40V72Z" stroke="currentColor" strokeWidth="2" /><path d="M142 80h9c24 0 24 35 0 35h-10M45 157h111M83 57c-14-16 15-19 1-36M106 57c-14-16 15-19 1-36M127 57c-14-16 15-19 1-36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></div></section>

    {locked && <div className="overview-security-note"><OverviewIcon name="shield" /><p><strong>Verify 2FA to see platform activity.</strong> Your administrator totals and review queue stay private until this session is verified.</p><Link href="/dashboard/security">Verify access<OverviewIcon name="arrow" /></Link></div>}

    <section className="overview-metrics" aria-label={admin ? "Platform summary" : "Your activity summary"}>{metrics.map(metric => <Link className="overview-metric" href={locked ? "/dashboard/security" : metric.href} key={metric.label} aria-label={`${metric.label}: ${metric.value === null ? "verification required" : metric.value}`}><span className={`overview-metric-icon overview-tone-${metric.tone}`}><OverviewIcon name={metric.icon} /></span><span className="overview-metric-label">{metric.label}</span><strong>{metric.value === null ? "—" : new Intl.NumberFormat("en-KE").format(metric.value)}</strong><span className="overview-metric-hint">{locked ? "Verify administrator access" : metric.hint}</span></Link>)}</section>

    <div className="overview-grid"><section className="overview-panel overview-recent" aria-labelledby="overview-recent-title"><div className="overview-panel-heading"><div><h2 id="overview-recent-title">{admin ? "Jobs awaiting review" : "Recent applications"}</h2><p>{admin ? "The next postings ready for your attention." : "Pick up where you left off."}</p></div><Link href={admin ? locked ? "/dashboard/security" : "/admin/jobs" : "/dashboard/applications"} className="overview-text-link">View all<OverviewIcon name="arrow" /></Link></div>
      {admin ? locked ? <EmptyState icon="shield" title="Your review queue is protected" text="Verify your administrator session to see postings awaiting review." href="/dashboard/security" label="Verify access" /> : !data.platform?.jobs.length ? <EmptyState icon="check" title="The review queue is clear" text="New job postings will appear here when employers submit them for review." /> : <ul className="overview-rows">{data.platform.jobs.map(job => <li key={job.id}><Link href={`/admin/jobs/${job.id}`} className="overview-record"><span className="overview-company-mark" aria-hidden="true">{job.organisation.charAt(0).toUpperCase()}</span><span className="overview-record-copy"><strong>{job.title}</strong><span>{job.organisation}</span><time dateTime={job.updatedAt.toISOString()}>{formatDeadline(job.updatedAt)}</time></span><span className="overview-status overview-status-pending">Awaiting review</span></Link></li>)}</ul>
      : !data.applications.length ? <EmptyState icon="briefcase" title="No applications yet" text="Explore coffee and hospitality opportunities, then save your first application." href="/jobs" label="Browse jobs" /> : <ul className="overview-rows">{data.applications.map(application => <li key={application.id}><Link href={`/dashboard/applications/${application.id}`} className="overview-record"><span className="overview-company-mark" aria-hidden="true">{application.organisation.charAt(0).toUpperCase()}</span><span className="overview-record-copy"><strong>{application.title}</strong><span>{application.organisation}</span><time dateTime={application.updatedAt.toISOString()}>{formatDeadline(application.updatedAt)}</time></span><span className={`overview-status overview-status-${application.status.toLowerCase()}`}>{applicationStatusLabels[application.status]}</span></Link></li>)}</ul>}
    </section>

    <section className="overview-panel" aria-labelledby="overview-checklist-title"><div className="overview-panel-heading"><div><h2 id="overview-checklist-title">{admin ? "Administrator access" : "Account essentials"}</h2><p>{admin ? "A secure foundation for your workspace." : "Get the essentials ready before applying."}</p></div><span className="overview-checklist-count">{completed}/3</span></div><div className="overview-progress" role="progressbar" aria-label={admin ? "Administrator access checklist" : "Account essentials checklist"} aria-valuemin={0} aria-valuemax={3} aria-valuenow={completed}><span style={{ width: `${completed / 3 * 100}%` }} /></div><ul className="overview-checklist">{steps.map(step => <li key={step.title}><Link href={step.href}><span className={`overview-step-icon${step.ready ? " is-complete" : ""}`} aria-label={step.ready ? "Complete" : "To do"}><OverviewIcon name={step.ready ? "check" : "arrow"} /></span><span><strong>{step.title}</strong><span>{step.hint}</span></span></Link></li>)}</ul><div className="overview-email"><span>Signed in with</span><strong>{user.email}</strong></div></section>

    <section className="overview-panel" aria-labelledby="overview-updates-title"><div className="overview-panel-heading"><div><h2 id="overview-updates-title">Latest updates</h2><p>{data.counts.unread ? `${data.counts.unread} unread update${data.counts.unread === 1 ? "" : "s"}` : "Your latest notifications and responses."}</p></div><Link className="overview-text-link" href="/dashboard/notifications">View all<OverviewIcon name="arrow" /></Link></div>{!data.notifications.length ? <EmptyState icon="bell" title="No updates yet" text="Application responses and account updates will appear here." /> : <ul className="overview-updates">{data.notifications.map(notification => <li key={notification.id}><Link href={notification.href}><span className={`overview-update-dot${!notification.readAt ? " is-unread" : ""}`} aria-label={!notification.readAt ? "Unread" : "Read"} /><span><strong>{notification.title}</strong><time dateTime={notification.createdAt.toISOString()}>{formatDeadline(notification.createdAt)}</time></span><OverviewIcon name="arrow" /></Link></li>)}</ul>}</section>

    <section className="overview-panel" aria-labelledby="overview-shortcuts-title"><div className="overview-panel-heading"><div><h2 id="overview-shortcuts-title">Quick access</h2><p>A shorter route to the things you need.</p></div></div><ul className="overview-shortcuts">{quickLinks.map(link => <li key={link.title}><Link href={link.href}><span className="overview-shortcut-icon"><OverviewIcon name={link.icon} /></span><span><strong>{link.title}</strong><span>{link.text}</span></span><OverviewIcon name="arrow" /></Link></li>)}</ul></section></div>
  </div>;
}

function EmptyState({ icon, title, text, href, label }: { icon: IconName; title: string; text: string; href?: string; label?: string }) {
  return <div className="overview-empty"><span className="overview-empty-icon"><OverviewIcon name={icon} /></span><h3>{title}</h3><p>{text}</p>{href && <Link className="overview-text-link" href={href}>{label}<OverviewIcon name="arrow" /></Link>}</div>;
}
