// Builds the applicant's application timeline: what has happened (oldest first), then the steps still ahead,
// ending with "Application closed". A status change and the message sent with it become one node.

type Status = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "SHORTLISTED" | "HIRED" | "REJECTED" | "WITHDRAWN";
export type TimelineInput = {
  status: Status; createdAt: Date;
  history: { toStatus: Status; message: string | null; createdAt: Date }[];
  responses: { id: string; source: string; senderLabel: string; body: string; status: Status; createdAt: Date }[];
};
export type TimelineNode = { key: string; tone: string; title: string; detail: string; at: Date | null; by?: string; message?: string; state: "done" | "current" | "upcoming" | "closed"; kind: "stage" | "message" };

const stage: Record<Status, { title: string; detail: string; tone: string }> = {
  DRAFT: { title: "Application started", detail: "You started your application. Add your cover letter and CV, then pay the fee to send it.", tone: "draft" },
  SUBMITTED: { title: "Application submitted", detail: "Your application and fee reached the recruiter.", tone: "submitted" },
  UNDER_REVIEW: { title: "Under review", detail: "The recruiter is reviewing your application.", tone: "review" },
  SHORTLISTED: { title: "Shortlisted", detail: "Good news: you've been shortlisted.", tone: "shortlisted" },
  HIRED: { title: "Hired", detail: "Congratulations, you got the job.", tone: "hired" },
  REJECTED: { title: "Not selected", detail: "The recruiter chose other candidates this time.", tone: "rejected" },
  WITHDRAWN: { title: "Withdrawn", detail: "You withdrew this application.", tone: "withdrawn" },
};
const ahead: Record<string, [string, string][]> = {
  DRAFT: [["Submit your application", "Pay the fee and your application goes to the recruiter."], ["Recruiter review", "The recruiter reads your profile, cover letter and CV."], ["Shortlist", "Strong candidates are shortlisted."]],
  SUBMITTED: [["Recruiter review", "The recruiter reads your profile, cover letter and CV."], ["Shortlist", "Strong candidates are shortlisted."]],
  UNDER_REVIEW: [["Shortlist", "Strong candidates are shortlisted."]],
  SHORTLISTED: [],
};
const closed = ["HIRED", "REJECTED", "WITHDRAWN"];
// Messages written automatically when a payment submits the application; the node already says it was submitted.
const automatic = (message: string | null) => !message || /^Application fee (confirmed|paid)/.test(message);

export function buildTimeline({ status, createdAt, history, responses }: TimelineInput): TimelineNode[] {
  const used = new Set<string>();
  const events: TimelineNode[] = [{ key: "start", kind: "stage", state: "done", at: createdAt, ...stage.DRAFT }];
  for (const [index, change] of history.entries()) {
    const match = responses.find(response => !used.has(response.id) && response.status === change.toStatus && response.body === change.message && Math.abs(response.createdAt.getTime() - change.createdAt.getTime()) < 60000);
    if (match) used.add(match.id);
    events.push({ key: `status-${index}`, kind: "stage", state: "done", at: change.createdAt, ...stage[change.toStatus], by: match && (match.source === "APPLICANT" ? "You" : match.senderLabel),
      message: automatic(change.message) || change.toStatus === "WITHDRAWN" && change.message === "The applicant withdrew this application." ? undefined : change.message ?? undefined });
  }
  for (const response of responses) if (!used.has(response.id))
    events.push({ key: `message-${response.id}`, kind: "message", state: "done", at: response.createdAt, tone: "message", title: `Message from ${response.senderLabel}`, detail: "", message: response.body });
  events.sort((a, b) => a.at!.getTime() - b.at!.getTime() || (a.key === "start" ? -1 : 0));
  // The latest step is where things stand now.
  const lastStage = [...events].reverse().find(event => event.kind === "stage");
  if (lastStage && !closed.includes(status)) lastStage.state = "current";
  if (closed.includes(status)) return [...events, { key: "closed", kind: "stage", state: "closed", at: lastStage?.at ?? null, tone: stage[status as Status].tone, title: "Application closed",
    detail: status === "HIRED" ? "This application ended with an offer. Well done!" : status === "WITHDRAWN" ? "No further updates will be sent for this application." : "Thank you for applying. Keep an eye on new jobs that suit you." }];
  return [...events,
    ...(ahead[status] ?? []).map(([title, detail], index) => ({ key: `ahead-${index}`, kind: "stage" as const, state: "upcoming" as const, at: null, tone: "upcoming", title, detail })),
    { key: "decision", kind: "stage", state: "upcoming", at: null, tone: "upcoming", title: "Final decision · application closed", detail: "You'll hear whether you were hired or not selected, and the application closes." }];
}
