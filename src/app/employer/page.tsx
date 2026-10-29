import Link from "next/link";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { Workspace } from "@/components/workspace";
import { EmployerHeading, EmployerEmpty } from "@/components/employer-ui";
export const dynamic = "force-dynamic";
export default async function Page() {
 const actor = await pageActor();
 const memberships = await getDb().organisationMember.findMany({ where: { userId: actor.user.id, organisation: { suspendedAt: null } }, include: { organisation: true }, orderBy: { organisation: { name: "asc" } } });
 return <Workspace name={actor.user.name || actor.user.email} admin={actor.user.role === "ADMIN"}><div className="employer-workspace"><EmployerHeading title="Good teams start here." description="Choose an organisation to manage its opportunities and help the right people find their next role."/><section className="employer-panel"><div className="employer-section-heading"><div><h2>Your organisations</h2><p>Active workspaces you have access to</p></div><span className="employer-count">{memberships.length}</span></div>{!memberships.length ? <EmployerEmpty title="Your employer workspace is waiting"><p>An administrator can invite you to an organisation. Open your invitation email to accept access.</p><Link className="employer-secondary" href="/dashboard">Back to your account</Link></EmployerEmpty> : <div className="employer-org-grid">{memberships.map(member => <Link key={member.id} href={"/employer/organisations/" + member.organisationId} className="employer-org-card"><span className="employer-org-mark" aria-hidden="true">{member.organisation.name.slice(0,2).toUpperCase()}</span><span className="employer-org-role">{member.role === "OWNER" ? "Organisation owner" : "Recruiter"}</span><h3>{member.organisation.name}</h3><p>Manage opportunities for your team.</p><span className="employer-card-action">Open workspace &#8599;</span></Link>)}</div>}</section><p className="employer-footnote">Organisation access is managed by KBO administrators. Your permissions apply only to your assigned workspaces.</p></div></Workspace>;
}
