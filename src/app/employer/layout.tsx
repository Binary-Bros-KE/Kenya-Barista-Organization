import type { ReactNode } from "react";
import { jobPageActor } from "@/lib/job-page-access";
import { WorkspaceFrame } from "@/components/workspace-frame";
export const dynamic = "force-dynamic";
// The sidebar and top bar stay on screen while recruiters move between pages; loading.tsx fills the content area meanwhile.
// Each page still checks access itself.
export default async function Layout({ children }: { children: ReactNode }) {
  const actor = await jobPageActor();
  return <WorkspaceFrame actor={actor}>{children}</WorkspaceFrame>;
}
