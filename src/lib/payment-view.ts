export const paymentLabels = { PENDING: "Pending", NEEDS_REVIEW: "Awaiting verification", SUCCEEDED: "Confirmed", FAILED: "Failed", CANCELLED: "Cancelled", REFUNDED: "Reversed" } as const;
export type PaymentViewStatus = keyof typeof paymentLabels;
export function paymentLabel(status: string) { return paymentLabels[status as PaymentViewStatus] || "Unavailable"; }
export function historyQuery(input: { page?: string; status?: string }) { const raw = Number(input.page || 1); return { page: Number.isInteger(raw) ? Math.min(Math.max(raw, 1), 100000) : 1, status: input.status && Object.hasOwn(paymentLabels, input.status) ? input.status as PaymentViewStatus : undefined }; }
export function historyHref(page: number, status?: string) { const q = new URLSearchParams(); if (status) q.set("status", status); if (page > 1) q.set("page", String(page)); return "/dashboard/payments" + (q.size ? "?" + q : ""); }
