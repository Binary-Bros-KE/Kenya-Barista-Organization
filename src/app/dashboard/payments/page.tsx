import { redirect } from "next/navigation";
import { historyHref, historyQuery } from "@/lib/payment-view";
// Payment history now lives in the Wallet tab; old links land on the same filter there.
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const { page, status } = historyQuery(await searchParams);
  redirect(historyHref(page, status));
}
