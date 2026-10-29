import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { ProfileForm, CvManager } from "@/components/applicant-forms";
export default async function Page() {
 const actor = await pageActor(); const db = getDb();
 const [profile,documents] = await Promise.all([db.applicantProfile.findUnique({ where: { userId: actor.user.id } }), db.document.findMany({ where: { userId: actor.user.id }, select: { id: true, filename: true, scanStatus: true }, orderBy: { createdAt: "desc" } })]);
 return <><h1>Your profile and CVs</h1><p className="intro">Keep your professional details ready for your next opportunity.</p><div className="grid gap-8 lg:grid-cols-2"><ProfileForm initial={{ fullName: profile?.fullName || actor.user.name || "", phone: profile?.phone || "", location: profile?.location || "", summary: profile?.summary || "" }} /><CvManager documents={documents} /></div></>;
}

