import "server-only";
import { redirect } from "next/navigation";
import { pageActor } from "./access";
// Employer pages are for recruiters; administrators reach them with full admin checks. Job seekers go back to their dashboard.
export async function jobPageActor(admin = false) {
  const actor = await pageActor(admin);
  if (actor.user.role === "ADMIN" && !admin) return pageActor(true);
  if (actor.user.role === "APPLICANT") redirect("/dashboard");
  return actor;
}
