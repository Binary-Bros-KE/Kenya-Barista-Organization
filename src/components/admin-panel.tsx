"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AdminConfirm } from "./admin-confirm";
import { postJson } from "./auth-form";

type Organisation = { id: string; name: string; slug: string; suspendedAt: string | null; _count: { members: number; jobs: number } };
type Invitation = { id: string; email: string; role: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null; organisation: { name: string } };
type User = { id: string; name: string | null; email: string; role: string; status: string; emailVerified: boolean };
type Member = { id: string; role: string; user: { name: string | null; email: string }; organisation: { name: string } };
type AuditEntry = { id: string; action: string; entityType: string; createdAt: string };
const tabs = ["Organisations", "Invitations", "Employer access", "Accounts", "Activity"] as const;

export function AdminPanel() {
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
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
    setOrganisations(results[0].organisations); setInvitations(results[1].invitations); setUsers(results[2].users); setMembers(results[3].memberships); setEntries(results[4].entries); setLoaded(true);
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
  const matches = (...values: (string | null)[]) => values.join(" ").toLowerCase().includes(search.trim().toLowerCase());
  return <div className="admin-management" aria-busy={busy||loading}><nav aria-label="Administration sections" className="admin-section-tabs">{tabs.map(item => <button key={item} disabled={busy} aria-pressed={tab===item} onClick={()=>{setTab(item);setSearch("");setMessage("");}}>{item}</button>)}</nav>
  {error && <div role="alert" className="admin-feedback is-error">{error}{!loaded && <button disabled={loading} onClick={()=>{setLoading(true);setError("");load().catch(failure=>setError(failure.message)).finally(()=>setLoading(false));}}>Try loading again</button>}</div>}{message && <p role="status" className="admin-feedback is-success">{message}</p>}
  {loading ? <div className="admin-loading" role="status">Loading administration...</div> : loaded && <><div className="admin-record-toolbar"><div><h2>{tab}</h2><p>Latest 50 records per section. Search applies to these loaded records.</p></div><label htmlFor="admin-record-search"><span className="sr-only">Search loaded {tab.toLowerCase()}</span><input id="admin-record-search" type="search" placeholder="Search loaded records" value={search} onChange={event=>setSearch(event.target.value)}/></label></div>
  {tab === "Organisations" && <div className="admin-management-grid"><form className="admin-panel admin-form" onSubmit={createOrganisation}><span className="admin-eyebrow">ADD A WORKSPACE</span><h2>Create organisation</h2><label>Organisation name<input name="name" required minLength={2} maxLength={120} disabled={busy}/></label><label>Short name<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} placeholder="nairobi-coffee-house" disabled={busy}/><span className="admin-help">Lowercase words separated by hyphens.</span></label><button disabled={busy} className="admin-primary">Create organisation</button></form><div className="admin-record-grid">{organisations.filter(org=>matches(org.name,org.slug)).map(org=><article className="admin-record" key={org.id}><header><span className="admin-record-mark">{org.name.slice(0,2).toUpperCase()}</span><span className={"admin-badge "+(org.suspendedAt?"is-warning":"is-active")}>{org.suspendedAt?"Suspended":"Active"}</span></header><h3>{org.name}</h3><p>{org.slug}</p><dl className="admin-record-facts"><div><dt>Members</dt><dd>{org._count.members}</dd></div><div><dt>Job postings</dt><dd>{org._count.jobs}</dd></div></dl>{org.suspendedAt?<button disabled={busy} className="admin-secondary" onClick={()=>void mutate(()=>patch("/api/admin/organisations/"+org.id,{suspended:false}),"Organisation reactivated.")}>Reactivate</button>:<AdminConfirm label="Suspend organisation" explanation="Employer access and recruitment actions for this organisation will be paused." busy={busy} onConfirm={()=>void mutate(()=>patch("/api/admin/organisations/"+org.id,{suspended:true}),"Organisation suspended.")}/>}</article>)}{!organisations.some(org=>matches(org.name,org.slug))&&<p className="admin-empty">No organisations match this view.</p>}</div></div>}
  {tab === "Invitations" && <div className="admin-management-grid"><form className="admin-panel admin-form" onSubmit={invite}><span className="admin-eyebrow">WELCOME AN EMPLOYER</span><h2>Invite an employer</h2><label>Organisation<select name="organisationId" required defaultValue="" disabled={busy}><option value="" disabled>Choose an active organisation</option>{organisations.filter(org=>!org.suspendedAt).map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></label><label>Employer email<input name="email" type="email" required maxLength={254} disabled={busy}/></label><label>Membership<select name="role" defaultValue="RECRUITER" disabled={busy}><option value="RECRUITER">Recruiter</option><option value="OWNER">Organisation owner</option></select></label><button disabled={busy||!organisations.some(org=>!org.suspendedAt)} className="admin-primary">Send invitation</button><p className="admin-help">Invitations expire in 48 hours. Employers must verify the invited email address.</p></form><div className="admin-record-grid">{invitations.filter(item=>matches(item.email,item.organisation.name)).map(invitation=>{const status=invitation.acceptedAt?"Accepted":invitation.revokedAt?"Revoked":new Date(invitation.expiresAt)<new Date()?"Expired":"Pending";return <article className="admin-record" key={invitation.id}><header><span className="admin-badge">{status}</span><span className="admin-help">{invitation.role === "OWNER" ? "Owner" : "Recruiter"}</span></header><h3>{invitation.email}</h3><p>{invitation.organisation.name}</p><p className="admin-help">Expires {new Intl.DateTimeFormat("en-KE",{timeZone:"Africa/Nairobi",dateStyle:"medium",timeStyle:"short"}).format(new Date(invitation.expiresAt))}</p>{status === "Pending"&&<AdminConfirm label="Revoke invitation" explanation="This invitation link will stop granting access." busy={busy} onConfirm={()=>void mutate(()=>postJson("/api/admin/invitations/"+invitation.id+"/revoke",{}),"Invitation revoked.")}/>}</article>;})}{!invitations.some(item=>matches(item.email,item.organisation.name))&&<p className="admin-empty">No invitations match this view.</p>}</div></div>}
  {tab === "Employer access" && <div className="admin-record-grid wide">{members.filter(member=>matches(member.user.name,member.user.email,member.organisation.name)).map(member=><article key={member.id} className="admin-record"><header><span className="admin-badge">{member.role === "OWNER"?"Owner":"Recruiter"}</span></header><h3>{member.user.name||member.user.email}</h3><p>{member.user.email}</p><p>{member.organisation.name}</p><AdminConfirm label="Remove access" explanation="This account will lose its membership of this organisation." busy={busy} onConfirm={()=>void mutate(()=>patch("/api/admin/memberships/"+member.id,{},"DELETE"),"Employer access removed.")}/></article>)}{!members.some(member=>matches(member.user.name,member.user.email,member.organisation.name))&&<p className="admin-empty">No employer memberships match this view.</p>}</div>}
  {tab === "Accounts" && <div className="admin-record-grid wide">{users.filter(user=>matches(user.name,user.email,user.role)).map(user=><article key={user.id} className="admin-record"><header><span className={"admin-badge "+(user.status==="ACTIVE"?"is-active":"is-warning")}>{user.status==="ACTIVE"?"Active":"Suspended"}</span><span className="admin-help">{user.role==="ADMIN"?"Administrator":"Applicant"}</span></header><h3>{user.name||"Applicant"}</h3><p>{user.email}</p><p className="admin-help">Email {user.emailVerified?"verified":"not verified"}</p>{user.role!=="ADMIN"&&(user.status==="ACTIVE"?<AdminConfirm label="Suspend account" explanation="This account will be suspended and its sessions revoked." busy={busy} onConfirm={()=>void mutate(()=>patch("/api/admin/users/"+user.id,{suspended:true}),"Account suspended and sessions revoked.")}/>:<button disabled={busy} className="admin-secondary" onClick={()=>void mutate(()=>patch("/api/admin/users/"+user.id,{suspended:false}),"Account reactivated.")}>Reactivate</button>)}</article>)}{!users.some(user=>matches(user.name,user.email,user.role))&&<p className="admin-empty">No accounts match this view.</p>}</div>}
  {tab === "Activity" && <div className="admin-panel admin-activity-list">{entries.filter(entry=>matches(entry.action,entry.entityType)).map(entry=><article key={entry.id}><span className="admin-badge">{entry.entityType}</span><h3>{entry.action.replaceAll("."," ").replaceAll("_"," ")}</h3><time dateTime={entry.createdAt}>{new Intl.DateTimeFormat("en-KE",{timeZone:"Africa/Nairobi",dateStyle:"medium",timeStyle:"short"}).format(new Date(entry.createdAt))} - Nairobi time</time></article>)}{!entries.some(entry=>matches(entry.action,entry.entityType))&&<p className="admin-empty">No administrative activity matches.</p>}</div>}
  </>}
  </div>;
}
