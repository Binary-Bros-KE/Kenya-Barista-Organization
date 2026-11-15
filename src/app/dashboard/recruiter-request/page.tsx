import { redirect } from "next/navigation";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { RecruiterRequest } from "@/components/recruiter-request";
import { myRecruiterRequest } from "@/server/recruiter-requests";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await pageActor();
  if (actor.user.role === "ADMIN") redirect("/admin?view=requests");
  const [request, profile] = await Promise.all([myRecruiterRequest(getDb(), actor), getDb().applicantProfile.findUnique({ where: { userId: actor.user.id }, select: { phone: true, location: true } })]);
  if (actor.user.role === "RECRUITER" && request?.status !== "APPROVED") redirect("/dashboard");
  return <RecruiterRequest request={request} phone={profile?.phone ?? ""} location={profile?.location ?? ""} />;
}
