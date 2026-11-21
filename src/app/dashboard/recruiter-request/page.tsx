import { redirect } from "next/navigation";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { RecruiterRequest } from "@/components/recruiter-request";
import { myRecruiterRequests } from "@/server/recruiter-requests";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await pageActor();
  if (actor.user.role === "ADMIN") redirect("/admin?view=requests");
  const [history, profile] = await Promise.all([myRecruiterRequests(getDb(), actor), getDb().applicantProfile.findUnique({ where: { userId: actor.user.id }, select: { phone: true, location: true } })]);
  if (actor.user.role === "RECRUITER" && history.request?.status !== "APPROVED") redirect("/dashboard");
  return <RecruiterRequest {...history} isRecruiter={actor.user.role === "RECRUITER"} phone={profile?.phone ?? ""} location={profile?.location ?? ""} />;
}
