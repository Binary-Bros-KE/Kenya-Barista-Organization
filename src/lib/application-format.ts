export const applicationStatusLabels = {
  DRAFT: "Draft", SUBMITTED: "Submitted", UNDER_REVIEW: "Under review",
  SHORTLISTED: "Shortlisted", HIRED: "Hired", REJECTED: "Not selected", WITHDRAWN: "Withdrawn",
} as const;
export const reviewTransitions: Record<string, string[]> = {
  SUBMITTED: ["UNDER_REVIEW", "SHORTLISTED", "REJECTED"],
  UNDER_REVIEW: ["SHORTLISTED", "REJECTED"],
  SHORTLISTED: ["HIRED", "REJECTED"], HIRED: [], REJECTED: [], WITHDRAWN: [],
};
export const withdrawableStatuses = ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"];
