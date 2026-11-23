"use client";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { JobApplicantsModal } from "./job-applicants";

// The Applications tab opens the same applicants popup as My jobs, for the application's job, with that applicant selected.
type Target = { id: string; job: { id: string; title: string } };

// A row that stays a real link (open in new tab still works) but opens the popup on a normal click.
export function ApplicantLink({ application, className, children }: { application: Target; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false), router = useRouter();
  return <>
    <a className={className} href={`/employer/applications?open=${encodeURIComponent(application.id)}`} onClick={event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault(); setOpen(true);
    }}>{children}</a>
    {open && <JobApplicantsModal job={application.job} initialId={application.id} onClose={() => { setOpen(false); router.refresh(); }} />}
  </>;
}

// Opens the popup on arrival, for links from emails and the dashboard (?open=<application id>).
export function OpenApplicant({ application }: { application: Target }) {
  const [open, setOpen] = useState(true), router = useRouter();
  return open ? <JobApplicantsModal job={application.job} initialId={application.id} onClose={() => { setOpen(false); router.replace("/employer/applications"); router.refresh(); }} /> : null;
}
