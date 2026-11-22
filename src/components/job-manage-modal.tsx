"use client";
import { useEffect, useRef } from "react";
import { JobEditor } from "./job-editor";

// "Manage posting" in a popup: the full job editor (details, cover, fee, review workflow) over the job list.
export function JobManageModal({ id, admin, imagesEnabled, onClose }: { id: string; admin: boolean; imagesEnabled: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="job-create job-manage" aria-labelledby="job-manage-title" onClose={onClose}>
    <div className="job-create-panel">
      <header className="job-create-head"><div><h2 id="job-manage-title">{admin ? "Review and manage posting" : "Manage posting"}</h2><p>Edit the details, change the cover, and move the posting through review.</p></div><button type="button" className="job-create-close" aria-label="Close" onClick={() => dialog.current?.close()}>&times;</button></header>
      <div className="job-create-body job-manage-body"><JobEditor id={id} admin={admin} imagesEnabled={imagesEnabled} /></div>
    </div>
  </dialog>;
}
