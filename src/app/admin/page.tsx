import { pageActor } from "@/lib/access";
import { Workspace } from "@/components/workspace";
import { AdminPanel } from "@/components/admin-panel";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await pageActor(true);
  return <Workspace name={actor.user.name || actor.user.email} admin><h1>Administration</h1><p className="intro">Manage organisations, employer access, and accounts.</p><Link href="/admin/jobs" className="button mb-8">Review jobs and configure fees</Link><AdminPanel /></Workspace>;
}
