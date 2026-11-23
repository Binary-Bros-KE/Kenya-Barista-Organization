import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { walletSummary } from "@/server/wallet";
export const dynamic = "force-dynamic";
// The signed-in account's wallet: balance, M-Pesa details to pay, claims and history.
export function GET(request: Request) { return api(request, actor => walletSummary(getDb(), actor)); }
