import { buildTimeline, type TimelineInput, type TimelineNode } from "@/lib/application-timeline";
import { formatDeadline } from "@/lib/job-format";

// The applicant's application as a chain of nodes: done steps are solid, the current one pulses,
// steps still ahead are faded on a dashed line, and a decided application ends with "Application closed".
const icons: Record<string, string> = {
  draft: "M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4", submitted: "M22 2 11 13M22 2l-7 20-4-9-9-4z", review: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  shortlisted: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z", hired: "M20 6 9 17l-5-5", rejected: "M18 6 6 18M6 6l12 12",
  withdrawn: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3", message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", upcoming: "M12 8v4l3 2",
};
const Icon = ({ tone, state }: { tone: string; state: TimelineNode["state"] }) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {state === "upcoming" ? <circle cx="12" cy="12" r="4" /> : state === "closed" ? <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" /> : <path d={icons[tone] ?? icons.submitted} />}</svg>;

export function ApplicationTimeline({ data }: { data: TimelineInput }) {
  const nodes = buildTimeline(data), next = nodes.findIndex(node => node.state === "upcoming"), done = nodes.filter(node => node.state !== "upcoming" && node.kind === "stage").length;
  return <section className="application-panel atl" aria-labelledby="atl-title">
    <div className="application-section-heading"><div><span className="application-eyebrow">STAY IN THE LOOP</span><h2 id="atl-title">Application timeline</h2><p>Every step of your application, from the moment you started to the final decision.</p></div>
      <span className="application-response-count" title="Steps completed">{done}</span></div>
    <ol className="atl-chain">{nodes.map((node, index) => <li key={node.key} className={`atl-node is-${node.state} is-${node.kind} tone-${node.tone}`} aria-current={node.state === "current" ? "step" : undefined}>
      <span className="atl-dot"><Icon tone={node.tone} state={node.state} /></span>
      <div className="atl-card">
        <div className="atl-head"><h3>{node.title}</h3>{node.state === "current" && <span className="atl-now">Now</span>}{index === next && <span className="atl-next">Up next</span>}</div>
        {node.at && node.state !== "closed" && <time dateTime={node.at.toISOString()}>{formatDeadline(node.at)}{node.by ? ` · by ${node.by}` : ""}</time>}
        {node.detail && <p className="atl-detail">{node.detail}</p>}
        {node.message && <blockquote className="atl-message">{node.message}</blockquote>}
      </div>
    </li>)}</ol>
  </section>;
}
