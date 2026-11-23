"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { postJson } from "./auth-form";
import { avatarSrc } from "@/lib/images";

export type SiteUser = { id: string; name: string | null; email: string; role: "APPLICANT" | "RECRUITER" | "ADMIN"; avatarVersion: number | null; unread: number };
// Kept for the life of the tab, so moving between website pages doesn't flash the signed-out buttons.
let known: SiteUser | null | undefined;

// The signed-in account, or null when signed out. Undefined while the first check is still loading.
export function useSiteUser() {
  const [user, setUser] = useState(known);
  useEffect(() => {
    let active = true;
    fetch("/api/session", { credentials: "same-origin", cache: "no-store" }).then(response => response.json()).then((data: { user: SiteUser | null }) => {
      known = data.user; if (active) setUser(known);
    }).catch(() => { if (active && known === undefined) setUser(known = null); });
    return () => { active = false; };
  }, []);
  return user;
}

const roleLabel = { APPLICANT: "Member", RECRUITER: "Recruiter", ADMIN: "Administrator" } as const;
// The account pages worth a shortcut from the website, by role.
export function accountLinks(user: SiteUser): [string, string][] {
  return [["Dashboard", "/dashboard"],
    ...(user.role === "ADMIN" ? [["Job review", "/admin/jobs"]] as [string, string][] : user.role === "RECRUITER" ? [["Jobs & applicants", "/employer/jobs"]] as [string, string][] : []),
    ["My applications", "/dashboard/applications"], ["Profile & CV", "/dashboard/profile"],
    [user.unread ? `Notifications (${user.unread > 99 ? "99+" : user.unread})` : "Notifications", "/dashboard/notifications"]];
}

async function signOut() {
  try { await postJson("/api/auth/sign-out", {}); } finally { known = null; window.location.reload(); }
}

export function SiteAvatar({ user }: { user: SiteUser }) {
  const photo = avatarSrc(user.id, user.avatarVersion, 36);
  const initials = ((user.name || user.email).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("") || "?").toUpperCase();
  return <span className={`site-user-avatar${photo ? " has-photo" : ""}`} aria-hidden="true">{photo ? <img src={photo} alt="" /> : initials}</span>;
}

// Desktop header: "My account" and "Sign in" for visitors; an account menu once signed in.
export function SiteAccount({ onNavigate }: { onNavigate: () => void }) { return <SiteAccountView user={useSiteUser()} onNavigate={onNavigate} />; }
export function SiteAccountView({ user, onNavigate }: { user: SiteUser | null | undefined; onNavigate: () => void }) {
  if (!user) return <div className={`site-desktop-account${user === undefined ? " is-checking" : ""}`} aria-hidden={user === undefined || undefined}>
    <Link href="/dashboard" className="site-account-link">My account</Link><Link href="/sign-in" className="site-sign-in">Sign in <span aria-hidden="true">&#8599;</span></Link>
  </div>;
  const name = user.name || user.email;
  return <div className="site-desktop-account">
    <details className="site-nav-dropdown site-user-menu" name="site-nav">
      <summary aria-label={`Account menu for ${name}`}>
        <span className="site-user-photo"><SiteAvatar user={user} />{user.unread > 0 && <span className="site-user-dot" aria-hidden="true" />}</span>
        <span className="site-user-copy"><strong>{name.split(/\s+/)[0]}</strong><span>{roleLabel[user.role]}</span></span>
        <svg className="site-nav-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 3.5 3 3 3-3"/></svg>
      </summary>
      <div>
        <p className="site-user-heading"><strong>{name}</strong><span>{user.email}</span></p>
        {accountLinks(user).map(([label, href]) => <Link key={href} href={href} onClick={onNavigate}>{label}</Link>)}
        <button type="button" className="site-user-sign-out" onClick={signOut}>Sign out</button>
      </div>
    </details>
  </div>;
}

// Mobile menu footer: the same choices as the desktop header.
export function SiteMobileAccount({ onNavigate }: { onNavigate: () => void }) { return <SiteMobileAccountView user={useSiteUser()} onNavigate={onNavigate} />; }
export function SiteMobileAccountView({ user, onNavigate }: { user: SiteUser | null | undefined; onNavigate: () => void }) {
  if (!user) return <div className="site-mobile-account"><Link href="/dashboard" onClick={onNavigate}>My account</Link><Link href="/sign-in" onClick={onNavigate}>Sign in</Link></div>;
  return <div className="site-mobile-account site-mobile-user">
    <p className="site-user-heading"><SiteAvatar user={user} /><span><strong>{user.name || user.email}</strong><span>{roleLabel[user.role]}</span></span></p>
    <div>{accountLinks(user).map(([label, href]) => <Link key={href} href={href} onClick={onNavigate}>{label}</Link>)}
      <button type="button" className="site-user-sign-out" onClick={signOut}>Sign out</button></div>
  </div>;
}
