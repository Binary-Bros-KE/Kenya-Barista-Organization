import { jobPageActor } from "@/lib/job-page-access";
import { FeeSettings } from "@/components/fee-settings";
import { JobList } from "@/components/job-list";
import { imagesEnabled } from "@/server/images";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await jobPageActor(true);
  return <><div className="admin-workspace"><FeeSettings /><JobList admin imagesEnabled={imagesEnabled()} /></div></>;
}
