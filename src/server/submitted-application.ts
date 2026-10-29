import type { Prisma } from "../generated/prisma/client";

// Recruitment can see confirmed submissions, including later refunds retained for the audit trail.
export const paidSubmission: Prisma.ApplicationWhereInput = {
  status: { not: "DRAFT" }, submittedAt: { not: null },
  paymentOrder: { is: { status: { in: ["SUCCEEDED", "REFUNDED"] }, paidAt: { not: null } } },
};
