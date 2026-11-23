import { jobPageActor } from "@/lib/job-page-access";
import { JobList } from "@/components/job-list";
import { imagesEnabled } from "@/server/images";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await jobPageActor(true);
  return <><div className="admin-workspace"><JobList admin imagesEnabled={imagesEnabled()} /></div></>;
}
