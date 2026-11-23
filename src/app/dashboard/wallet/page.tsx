import { Suspense } from "react";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { walletSummary } from "@/server/wallet";
import { WalletView } from "@/components/wallet";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await pageActor();
  return <Suspense><WalletView data={await walletSummary(getDb(), actor)} /></Suspense>;
}
