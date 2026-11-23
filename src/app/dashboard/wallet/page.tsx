import { Suspense } from "react";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { walletSummary } from "@/server/wallet";
import { applicantPayments } from "@/server/applicant-payments";
import { WalletView } from "@/components/wallet";
import { PaymentHistory } from "@/components/payment-history";
export const dynamic = "force-dynamic";
// The wallet, followed by application fees paid straight from M-Pesa (shown once there are any).
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const actor = await pageActor(), db = getDb(), query = await searchParams;
  const [wallet, payments] = await Promise.all([walletSummary(db, actor), applicantPayments(db, actor, query)]);
  const anyPayments = Object.values(payments.counts).some(count => count > 0);
  return <Suspense><WalletView data={wallet} />{(anyPayments || query.status || query.page) && <PaymentHistory result={payments} />}</Suspense>;
}
