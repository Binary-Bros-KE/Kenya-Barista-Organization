"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { postJson } from "./auth-form";

type Organisation = { id: string; name: string; slug: string; suspendedAt: string | null; _count: { members: number; jobs: number } };
type Invitation = { id: string; email: string; role: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null; organisation: { name: string } };
type User = { id: string; name: string | null; email: string; role: string; status: string; emailVerified: boolean };
type Member = { id: string; role: string; user: { name: string | null; email: string }; organisation: { name: string } };
type AuditEntry = { id: string; action: string; entityType: string; createdAt: string };
const tabs = ["Organisations", "Invitations", "Employer access", "Accounts", "Activity"] as const;

export function AdminPanel() {
  const [tab, setTab] = useState<typeof tabs[number]>("Organisations");
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const results = await Promise.all(["organisations", "invitations", "users", "memberships", "audit-log"].map(async name => {
      const response = await fetch(`/api/admin/${name}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load administration");
      return data;
    }));
    setOrganisations(results[0].organisations); setInvitations(results[1].invitations); setUsers(results[2].users); setMembers(results[3].memberships); setEntries(results[4].entries);
  }, []);
  useEffect(() => { load().catch(error => setError(error.message)).finally(() => setLoading(false)); }, [load]);
  async function mutate(action: () => Promise<unknown>, success: string, form?: HTMLFormElement) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); form?.reset(); setMessage(success); await load(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to complete request"); }
    finally { setBusy(false); }
  }
  async function patch(url: string, body: unknown, method = "PATCH") {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to complete request");
    return data;
  }
  function createOrganisation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const element = event.currentTarget; const data = new FormData(element);
    void mutate(() => postJson("/api/admin/organisations", { name: data.get("name"), slug: data.get("slug") }), "Organisation created.", element);
  }
  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const element = event.currentTarget; const data = new FormData(element);
    void mutate(() => postJson("/api/admin/invitations", { organisationId: data.get("organisationId"), email: data.get("email"), role: data.get("role") }), "Invitation sent. Earlier pending links for this email and organisation have been revoked.", element);
  }
  return <div className="form-stack">
    <nav aria-label="Administration sections" className="flex flex-wrap gap-2">{tabs.map(item => <button key={item} aria-pressed={tab === item} className={`button ${tab === item ? "" : "secondary"}`} onClick={() => { setTab(item); setMessage(""); }}>{item}</button>)}</nav>
    {error && <p role="alert" className="notice error">{error}</p>}{message && <p role="status" className="notice success">{message}</p>}
    {loading ? <p role="status">Loading administration…</p> : <>
      <p className="hint">Showing the latest 50 records in each section.</p>
      {tab === "Organisations" && <>
        <form className="card form-stack max-w-xl" onSubmit={createOrganisation}><h2>Create organisation</h2><label>Organisation name<input name="name" required minLength={2} maxLength={120} /></label><label>Short name<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} placeholder="nairobi-coffee-house" /><span className="hint">Lowercase words separated by hyphens.</span></label><button disabled={busy} className="button">Create organisation</button></form>
        <div className="card overflow-x-auto"><table><thead><tr><th>Name</th><th>Members</th><th>Status</th><th>Access</th></tr></thead><tbody>{organisations.map(org => <tr key={org.id}><td>{org.name}</td><td>{org._count.members}</td><td>{org.suspendedAt ? "Suspended" : "Active"}</td><td><button disabled={busy} className="button secondary" onClick={() => void mutate(() => patch(`/api/admin/organisations/${org.id}`, { suspended: !org.suspendedAt }), org.suspendedAt ? "Organisation reactivated." : "Organisation suspended.")}>{org.suspendedAt ? "Reactivate" : "Suspend"}</button></td></tr>)}</tbody></table>{!organisations.length && <p className="hint mt-4">No organisations yet.</p>}</div>
      </>}
      {tab === "Invitations" && <>
        <form className="card form-stack max-w-xl" onSubmit={invite}><h2>Invite an employer</h2><label>Organisation<select name="organisationId" required defaultValue=""><option value="" disabled>Choose an active organisation</option>{organisations.filter(org => !org.suspendedAt).map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label><label>Employer email<input name="email" type="email" required maxLength={254} /></label><label>Membership<select name="role" defaultValue="RECRUITER"><option value="RECRUITER">Recruiter</option><option value="OWNER">Organisation owner</option></select></label><button disabled={busy || !organisations.some(org => !org.suspendedAt)} className="button">Send invitation</button><p className="hint">Invitations expire in 48 hours. Employers must verify the invited email address.</p></form>
        <div className="card overflow-x-auto"><table><thead><tr><th>Email</th><th>Organisation</th><th>Status</th><th>Action</th></tr></thead><tbody>{invitations.map(invitation => {
          const status = invitation.acceptedAt ? "Accepted" : invitation.revokedAt ? "Revoked" : new Date(invitation.expiresAt) < new Date() ? "Expired" : "Pending";
          return <tr key={invitation.id}><td>{invitation.email}</td><td>{invitation.organisation.name}</td><td>{status}</td><td>{status === "Pending" && <button disabled={busy} className="button secondary" onClick={() => void mutate(() => postJson(`/api/admin/invitations/${invitation.id}/revoke`, {}), "Invitation revoked.")}>Revoke</button>}</td></tr>;
        })}</tbody></table>{!invitations.length && <p className="hint mt-4">No invitations yet.</p>}</div>
      </>}
      {tab === "Employer access" && <div className="card overflow-x-auto"><table><thead><tr><th>Email</th><th>Organisation</th><th>Membership</th><th>Action</th></tr></thead><tbody>{members.map(member => <tr key={member.id}><td>{member.user.email}</td><td>{member.organisation.name}</td><td>{member.role === "OWNER" ? "Owner" : "Recruiter"}</td><td><button className="button secondary" disabled={busy} onClick={() => void mutate(() => patch(`/api/admin/memberships/${member.id}`, {}, "DELETE"), "Employer access removed.")}>Remove access</button></td></tr>)}</tbody></table>{!members.length && <p className="hint mt-4">No employer memberships yet.</p>}</div>}
      {tab === "Accounts" && <div className="card overflow-x-auto"><table><thead><tr><th>Account</th><th>Email</th><th>Verification</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td>{user.name || "Applicant"}{user.role === "ADMIN" && " · Administrator"}</td><td>{user.email}</td><td>{user.emailVerified ? "Verified" : "Unverified"}</td><td>{user.status === "ACTIVE" ? "Active" : "Suspended"}</td><td>{user.role !== "ADMIN" && <button className="button secondary" disabled={busy} onClick={() => void mutate(() => patch(`/api/admin/users/${user.id}`, { suspended: user.status === "ACTIVE" }), user.status === "ACTIVE" ? "Account suspended and sessions revoked." : "Account reactivated.")}>{user.status === "ACTIVE" ? "Suspend" : "Reactivate"}</button>}</td></tr>)}</tbody></table></div>}
      {tab === "Activity" && <div className="card overflow-x-auto"><table><thead><tr><th>Action</th><th>Record type</th><th>Time (Nairobi)</th></tr></thead><tbody>{entries.map(entry => <tr key={entry.id}><td>{entry.action.replaceAll(".", " ").replaceAll("_", " ")}</td><td>{entry.entityType}</td><td>{new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</td></tr>)}</tbody></table>{!entries.length && <p className="hint mt-4">No administrative activity yet.</p>}</div>}
    </>}
  </div>;
}
