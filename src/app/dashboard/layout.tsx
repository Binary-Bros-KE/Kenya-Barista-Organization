import { pageActor } from "@/lib/access";
import { Workspace } from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const actor = await pageActor();
  return <Workspace name={actor.user.name || actor.user.email} admin={actor.user.role === "ADMIN"}>{children}</Workspace>;
}
