import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { ProfileForm, CvManager } from "@/components/applicant-forms";
export default async function Page() {
  const actor = await pageActor(), db = getDb();
  const [profile, documents] = await Promise.all([
    db.applicantProfile.findUnique({ where: { userId: actor.user.id } }),
    db.document.findMany({ where: { userId: actor.user.id }, select: { id: true, filename: true, scanStatus: true, sizeBytes: true, createdAt: true, _count: { select: { applications: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  return <div className="profile-workspace"><header className="profile-page-heading"><span className="profile-eyebrow">YOUR CAREER TOOLKIT</span><h1>A great opportunity starts with you.</h1><p>Bring your experience to life. Keep your profile current and your CV ready for your next move.</p></header>
    <div className="profile-layout"><ProfileForm initial={{ fullName: profile?.fullName || actor.user.name || "", phone: profile?.phone || "", location: profile?.location || "", summary: profile?.summary || "" }} /><CvManager documents={documents.map(({ _count, createdAt, ...doc }) => ({ ...doc, createdAt: createdAt.toISOString(), attachmentCount: _count.applications }))} /></div>
  </div>;
}
