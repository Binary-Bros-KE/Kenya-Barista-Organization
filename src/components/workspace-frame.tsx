import type { ReactNode } from "react";
import type { Actor } from "@/server/access";
import { Workspace } from "./workspace";

// Server wrapper for the workspace shell: the account type (job seeker, recruiter, admin) decides the sidebar on every page.
export function WorkspaceFrame({ actor, children }: { actor: Actor; children: ReactNode }) {
  return <Workspace name={actor.user.name || actor.user.email} admin={actor.user.role === "ADMIN"} recruiter={actor.user.role === "RECRUITER"}>{children}</Workspace>;
}
