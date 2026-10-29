"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SignOut } from "./sign-out";

type IconName = "account" | "profile" | "applications" | "payments" | "notifications" | "security" | "organisations" | "jobs" | "review" | "settings" | "queue" | "admin" | "menu" | "close" | "collapse" | "expand" | "external";
type Item = { label: string; href: string; icon: IconName };
const accountLinks: Item[] = [
  { label: "My account", href: "/dashboard", icon: "account" },
  { label: "Profile and CVs", href: "/dashboard/profile", icon: "profile" },
  { label: "Applications", href: "/dashboard/applications", icon: "applications" },
  { label: "Payments", href: "/dashboard/payments", icon: "payments" },
  { label: "Notifications", href: "/dashboard/notifications", icon: "notifications" },
  { label: "Security", href: "/dashboard/security", icon: "security" },
];
const employerLinks: Item[] = [
  { label: "Organisations", href: "/employer", icon: "organisations" },
  { label: "My postings", href: "/employer/jobs", icon: "jobs" },
  { label: "Review applicants", href: "/employer/applications", icon: "review" },
];
const adminLinks: Item[] = [
  { label: "Administration", href: "/admin", icon: "admin" },
  { label: "Job review", href: "/admin/jobs", icon: "review" },
  { label: "M-Pesa settings", href: "/admin/payments", icon: "settings" },
  { label: "Delivery queue", href: "/admin/notifications", icon: "queue" },
];
const exploreLinks: Item[] = [{ label: "Find jobs", href: "/jobs", icon: "jobs" }];

function Icon({ name }: { name: IconName }) {
  const shapes: Record<IconName, ReactNode> = {
    account: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    applications: <><path d="M8 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-3" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="m8 13 2 2 5-5M8 18h8" /></>,
    payments: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h3" /></>,
    notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    security: <><path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Z" /><path d="m8 11 3 3 5-5" /></>,
    organisations: <><path d="M4 21V5h10v16M14 10h6v11M2 21h20M8 9h2M8 13h2M8 17h2M17 14h1M17 18h1" /></>,
    jobs: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V4h8v3M3 12a20 20 0 0 0 18 0M10 13h4" /></>,
    review: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2m1-9 2 2 4-4M16 5a3 3 0 0 1 0 6" /></>,
    settings: <><path d="M4 7h16M4 17h16M8 4v6M16 14v6" /><circle cx="8" cy="7" r="2" /><circle cx="16" cy="17" r="2" /></>,
    queue: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 6 9 7 9-7M8 17h8" /></>,
    admin: <><circle cx="12" cy="8" r="3" /><path d="M6 21v-2a6 6 0 0 1 12 0v2M3 3h4M3 3v4M21 3h-4M21 3v4" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    collapse: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m7-11-3 3 3 3" /></>,
    expand: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m4-11 3 3-3 3" /></>,
    external: <path d="M14 3h7v7m0-7L10 14M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name]}</svg>;
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/admin") return pathname === href;
  if (href === "/employer") return pathname === href || pathname.startsWith("/employer/organisations/");
  return pathname === href || pathname.startsWith(href + "/");
}

export function Workspace({ name, admin, children }: { name: string; admin: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const mobileClose = useRef<HTMLButtonElement>(null);
  const items = [...accountLinks, ...employerLinks, ...(admin ? adminLinks : []), ...exploreLinks];
  const current = items.find(item => isActive(pathname, item.href));
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "KB";

  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem("kbo-sidebar-collapsed") === "true"); } catch {}
  }, []);
  useEffect(() => { dialog.current?.close(); }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const resize = () => { if (media.matches) dialog.current?.close(); };
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobileOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try { window.localStorage.setItem("kbo-sidebar-collapsed", String(next)); } catch {}
  }
  function openMobile() {
    if (!dialog.current?.open) dialog.current?.showModal();
    setMobileOpen(true);
    mobileClose.current?.focus();
  }
  function closeMobile() { dialog.current?.close(); }
  function group(label: string, links: Item[], mobile: boolean) {
    return <div className="workspace-nav-group" key={label}>
      <p className="workspace-nav-heading">{label}</p>
      {links.map(item => <Link key={item.href} href={item.href} className={`workspace-nav-link${isActive(pathname, item.href) ? " is-active" : ""}`}
        aria-current={isActive(pathname, item.href) ? "page" : undefined} aria-label={item.label}
        title={!mobile && collapsed ? item.label : undefined} onClick={mobile ? closeMobile : undefined}>
        <Icon name={item.icon} /><span className="workspace-link-label">{item.label}</span>
      </Link>)}
    </div>;
  }
  function navigation(mobile: boolean) {
    return <>
      <div className="workspace-brand-row"><Link href="/" className="workspace-brand" aria-label="Kenya Barista Organization home" onClick={mobile ? closeMobile : undefined}>
        <img src="/brand-logo.png" width={46} height={45} alt="Kenya Barista Organization" />
        <span className="workspace-brand-copy"><strong>Kenya Barista</strong><span>Career workspace</span></span>
      </Link>{mobile && <button ref={mobileClose} type="button" className="workspace-icon-button workspace-drawer-close" aria-label="Close navigation" onClick={closeMobile}><Icon name="close" /></button>}</div>
      <nav className="workspace-navigation" aria-label="Account navigation">
        {group("Your workspace", accountLinks, mobile)}
        {group("For employers", employerLinks, mobile)}
        {admin && group("Administration", adminLinks, mobile)}
        {group("Explore", exploreLinks, mobile)}
      </nav>
      <div className="workspace-sidebar-footer"><SignOut /><p className="workspace-footer-note">Let’s talk coffee.</p></div>
    </>;
  }
  return <div className={`workspace-shell${collapsed ? " workspace-shell-collapsed" : ""}`}>
    <a className="workspace-skip" href="#workspace-content">Skip to content</a>
    <aside className="workspace-sidebar" id="workspace-sidebar">{navigation(false)}</aside>
    <div className="workspace-frame">
      <header className="workspace-topbar">
        <div className="workspace-topbar-leading">
          <button type="button" className="workspace-icon-button workspace-desktop-toggle" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="workspace-sidebar" title={collapsed ? "Expand sidebar" : "Collapse sidebar"}><Icon name={collapsed ? "expand" : "collapse"} /></button>
          <button ref={mobileTrigger} type="button" className="workspace-icon-button workspace-mobile-toggle" onClick={openMobile} aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={mobileOpen} aria-controls="workspace-mobile-navigation"><Icon name="menu" /></button>
          <div className="workspace-page-context"><span>{admin ? "Administrator workspace" : "Your workspace"}</span><strong>{current?.label || "My account"}</strong></div>
        </div>
        <div className="workspace-topbar-trailing">
          <Link href="/" className="workspace-website-link"><Icon name="external" /><span>Website</span></Link>
          <div className="workspace-user" aria-label={`Signed in as ${name}`}><span className="workspace-avatar" aria-hidden="true">{initials}</span><span className="workspace-user-copy"><strong title={name}>{name}</strong><span>{admin ? "Administrator" : "Member"}</span></span></div>
        </div>
      </header>
      <main className="workspace-content" id="workspace-content" tabIndex={-1}>{children}</main>
    </div>
    <dialog ref={dialog} id="workspace-mobile-navigation" className="workspace-mobile-dialog" aria-label="Workspace navigation"
      onClose={() => { setMobileOpen(false); if (!window.matchMedia("(min-width: 1024px)").matches) mobileTrigger.current?.focus(); }}
      onClick={event => { if (event.target === event.currentTarget) closeMobile(); }}>
      <div className="workspace-mobile-panel">{navigation(true)}</div>
    </dialog>
  </div>;
}
