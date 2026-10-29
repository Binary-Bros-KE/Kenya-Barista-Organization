import Link from "next/link";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { Workspace } from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await pageActor();
  const memberships = await getDb().organisationMember.findMany({ where: { userId: actor.user.id, organisation: { suspendedAt: null } }, include: { organisation: true } });
  return <Workspace name={actor.user.name || actor.user.email} admin={actor.user.role === "ADMIN"}><h1>Your organisations</h1><p className="intro">Choose an organisation workspace.</p>{!memberships.length && <div className="card"><h2>No employer access yet</h2><p className="mt-3 text-stone-600">An administrator can invite you to an organisation. Open your invitation email to accept access.</p></div>}<div className="grid gap-5 sm:grid-cols-2">{memberships.map(member => <Link key={member.id} href={`/employer/organisations/${member.organisationId}`} className="card"><h2>{member.organisation.name}</h2><p className="mt-3 text-sm text-stone-500">{member.role === "OWNER" ? "Organisation owner" : "Recruiter"} →</p></Link>)}</div></Workspace>;
}
