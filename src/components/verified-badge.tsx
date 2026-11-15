// "Verified" mark for recruiters whose contact details KBO has confirmed.
export function VerifiedBadge({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return <span className={`verified-badge${compact ? " is-compact" : ""} ${className}`.trim()} title="KBO has confirmed this recruiter's contact details">
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 1.5 14.6 3.3l3.1-.2 1 2.9 2.6 1.8-.9 3 .9 3-2.6 1.8-1 2.9-3.1-.2L12 22.5l-2.6-1.8-3.1.2-1-2.9-2.6-1.8.9-3-.9-3 2.6-1.8 1-2.9 3.1.2z" /><path d="m8 12.2 2.7 2.7L16.2 9.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    {!compact && <span>Verified</span>}{compact && <span className="verified-badge-sr">Verified recruiter</span>}
  </span>;
}
