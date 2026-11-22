import type { ReactNode } from "react";
import { pageActor } from "@/lib/access";
import { WorkspaceFrame } from "@/components/workspace-frame";
export const dynamic = "force-dynamic";
// The sidebar and top bar stay on screen while administrators move between pages; loading.tsx fills the content area meanwhile.
// Each page still checks access itself.
export default async function Layout({ children }: { children: ReactNode }) {
  const actor = await pageActor(true);
  return <WorkspaceFrame actor={actor}>{children}</WorkspaceFrame>;
}
