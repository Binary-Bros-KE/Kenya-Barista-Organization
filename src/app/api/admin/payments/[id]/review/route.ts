import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { paymentReviewDetail, resolvePaymentException } from "@/server/payment-review";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => paymentReviewDetail(getDb(), actor, (await context.params).id), true);
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async actor => resolvePaymentException(getDb(), actor, (await context.params).id, await jsonInput(request)), true);
}
