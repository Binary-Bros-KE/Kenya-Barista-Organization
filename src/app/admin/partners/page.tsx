import { pageActor } from "@/lib/access";
import { AdminPartners } from "@/components/admin-partners";
export const dynamic = "force-dynamic";
// Organisations that asked to partner with KBO, and where those requests are emailed.
export default async function Page() {
  await pageActor(true);
  return <div className="admin-workspace"><AdminPartners /></div>;
}
