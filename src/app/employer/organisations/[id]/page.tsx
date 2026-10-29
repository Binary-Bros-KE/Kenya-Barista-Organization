import { EmployerHeading } from "@/components/employer-ui";
import { notFound } from "next/navigation";
import Link from "next/link";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { requireOrganisation } from "@/server/access";
import { AccessError } from "@/server/errors";
import { Workspace } from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor();
  let membership;
  try { membership = await requireOrganisation(getDb(), actor, (await params).id); }
  catch (error) { if (error instanceof AccessError && error.status === 404) notFound(); throw error; }
  return <Workspace name={actor.user.name || actor.user.email} admin={actor.user.role === "ADMIN"}><div className="employer-workspace"><EmployerHeading title={membership.organisation.name} description="Your team's space for opportunities, applications and the people behind them." back={{ href: "/employer", label: "Your organisations" }}/><div className="employer-access-banner"><span className="employer-status status-published">Access active</span><div><h2>{membership.role === "OWNER" ? "Organisation owner" : "Recruiter"}</h2><p>Your access is limited to this organisation. Contact the platform administrator to change your membership.</p></div></div><div className="employer-org-actions"><Link className="employer-action-card" href={"/employer/jobs?organisationId="+membership.organisationId}><span className="employer-eyebrow">YOUR OPPORTUNITIES</span><h2>Manage job postings</h2><p>Pick up drafts, follow review feedback and manage published roles.</p><span>Open postings &#8594;</span></Link><Link className="employer-action-card" href={"/employer/jobs/new?organisationId="+membership.organisationId}><span className="employer-eyebrow">BUILD YOUR TEAM</span><h2>Create an opportunity</h2><p>Prepare a clear job description and send it to KBO for review.</p><span>Create a posting &#8594;</span></Link></div></div></Workspace>;
}
