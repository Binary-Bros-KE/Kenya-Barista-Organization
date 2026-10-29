import { notFound } from "next/navigation";
import { jobPageActor } from "@/lib/job-page-access";
import { getDb } from "@/lib/db";
import { getManagedJob } from "@/server/jobs";
import { AccessError } from "@/server/errors";
import { Workspace } from "./workspace";
import { JobEditor } from "./job-editor";
export async function ManagedJobPage({ id, admin = false }: { id: string; admin?: boolean }) {
  const actor = await jobPageActor(admin);
  try { await getManagedJob(getDb(), actor, id); }
  catch (error) { if (error instanceof AccessError && error.status === 404) notFound(); throw error; }
  return <Workspace name={actor.user.name || actor.user.email} admin={actor.user.role === "ADMIN"}><h1>{admin ? "Review job posting" : "Manage job posting"}</h1><p className="intro">Review the saved details and choose the next action.</p><JobEditor id={id} admin={actor.user.role === "ADMIN"} /></Workspace>;
}
