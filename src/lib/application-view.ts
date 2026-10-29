import { applicationStatusLabels } from "./application-format";
export type ApplicationStatus = keyof typeof applicationStatusLabels;
export function applicationListQuery(input: { page?: string; status?: string }) {
  const raw = Number(input.page || 1);
  return { page: Number.isInteger(raw) ? Math.min(Math.max(raw, 1), 100000) : 1,
    status: input.status && Object.hasOwn(applicationStatusLabels, input.status) ? input.status as ApplicationStatus : undefined };
}
export function applicationListHref(page: number, status?: string) {
  const query = new URLSearchParams(); if (status) query.set("status", status); if (page > 1) query.set("page", String(page));
  return "/dashboard/applications" + (query.size ? "?" + query.toString() : "");
}
export function applicationGuidance(status: string, editable: boolean) {
  if (status === "DRAFT") return editable ? "Save your cover letter and CV, then complete payment to submit your application." : "Your saved application is locked while payment is pending, paid or under review. Check the payment section before taking another action.";
  if (status === "WITHDRAWN") return "You withdrew this application. Further consideration and employer CV downloads have stopped. Withdrawal does not automatically refund your fee.";
  if (status === "HIRED") return "You have been marked as hired. Check the responses below for details from the recruitment team.";
  if (status === "REJECTED") return "You were not selected for this role. You can read the responses below and explore other opportunities.";
  if (status === "SHORTLISTED") return "You have been shortlisted. Check the responses below for the recruitment team's next steps.";
  if (status === "UNDER_REVIEW") return "The recruitment team is reviewing your application. Any messages or status updates will appear below.";
  return "Your application has been submitted. Check the responses below for recruitment updates.";
}
