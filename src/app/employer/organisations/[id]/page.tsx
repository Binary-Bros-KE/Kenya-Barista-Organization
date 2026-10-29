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
  return <Workspace name={actor.user.name || actor.user.email} admin={actor.user.role === "ADMIN"}><h1>{membership.organisation.name}</h1><p className="intro">Your organisation workspace</p><div className="card"><h2>Employer access is active</h2><p className="mt-3 text-stone-600">Your access is limited to this organisation. Contact the platform administrator to change your membership.</p><div className="mt-6 flex flex-wrap gap-4"><Link className="button" href={`/employer/jobs?organisationId=${membership.organisationId}`}>Manage job postings</Link><Link className="button secondary" href={`/employer/jobs/new?organisationId=${membership.organisationId}`}>Create a posting</Link></div></div></Workspace>;
}
