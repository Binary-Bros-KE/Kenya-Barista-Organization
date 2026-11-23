import { pageActor } from "@/lib/access";
import { AdminWallet } from "@/components/admin-wallet";
export const dynamic = "force-dynamic";
// Wallet top-ups members say they've sent by M-Pesa, to check and confirm.
export default async function Page() {
  await pageActor(true);
  return <div className="admin-workspace"><AdminWallet /></div>;
}
