import type { ReactNode } from "react";
import { getDb } from "@/lib/db";
import type { Actor } from "@/server/access";
import { Workspace } from "./workspace";
import { avatarSrc } from "@/lib/images";

// Server wrapper for the workspace shell: the account type (job seeker, recruiter, admin) decides the sidebar on every page.
// Administrators also see how many recruiter requests are waiting.
export async function WorkspaceFrame({ actor, children }: { actor: Actor; children: ReactNode }) {
  const admin = actor.user.role === "ADMIN";
  const pending = admin ? await getDb().recruiterRequest.count({ where: { status: "PENDING" } }) : 0;
  return <Workspace name={actor.user.name || actor.user.email} admin={admin} recruiter={actor.user.role === "RECRUITER"} badges={pending ? { "/admin": pending } : {}} photo={avatarSrc(actor.user.id, actor.user.avatarVersion, 34)}>{children}</Workspace>;
}
