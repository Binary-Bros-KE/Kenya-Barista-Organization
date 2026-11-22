import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { CvManager } from "@/components/applicant-forms";
import { ProfileStudio } from "@/components/profile-studio";
import { imagesEnabled } from "@/server/images";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await pageActor(), db = getDb();
  const [profile, documents] = await Promise.all([
    db.applicantProfile.findUnique({ where: { userId: actor.user.id } }),
    db.document.findMany({ where: { userId: actor.user.id, retiredAt: null }, select: { id: true, filename: true, scanStatus: true, sizeBytes: true, createdAt: true, _count: { select: { applications: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  const usableCvs = documents.filter(doc => doc.scanStatus === "CLEAN" || doc.scanStatus === "PENDING").length;
  return <div className="profile-workspace"><header className="profile-page-heading"><span className="profile-eyebrow">YOUR PROFILE</span><h1>A great opportunity starts with you.</h1><p>Add a photo, your skills and your story. The preview shows exactly what recruiters see when you apply.</p></header>
    <ProfileStudio userId={actor.user.id} avatarVersion={actor.user.avatarVersion} imagesEnabled={imagesEnabled()} cvCount={usableCvs} initial={{
      fullName: profile?.fullName || actor.user.name || "", phone: profile?.phone || "", location: profile?.location || "", summary: profile?.summary || "",
      headline: profile?.headline || "", experienceYears: profile?.experienceYears ?? null, skills: profile?.skills ?? [], openToWork: profile?.openToWork ?? true,
      instagram: profile?.instagram ? `@${profile.instagram}` : "", linkedin: profile?.linkedin || "", website: profile?.website || "", accent: profile?.accent || "espresso",
    }} />
    {actor.user.role !== "ADMIN" && <div className="studio-cvs" id="cvs"><CvManager documents={documents.map(({ _count, createdAt, ...doc }) => ({ ...doc, createdAt: createdAt.toISOString(), attachmentCount: _count.applications }))} /></div>}
  </div>;
}
