import { pageActor } from "@/lib/access";
import { WorkspaceFrame } from "@/components/workspace-frame";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const actor = await pageActor();
  return <WorkspaceFrame actor={actor}>{children}</WorkspaceFrame>;
}
