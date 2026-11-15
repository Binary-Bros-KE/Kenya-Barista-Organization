import type { CSSProperties, ReactNode } from "react";

// Shared pieces for the administrator list pages (Accounts, Recruiters).
export type IconName = "plus" | "users" | "send" | "trash" | "external" | "people" | "check" | "mail" | "pulse" | "search" | "close" | "chevron" | "file" | "briefcase" | "building" | "shield" | "device" | "clock" | "ban" | "undo" | "phone" | "pin" | "spark";
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const shapes: Record<IconName, ReactNode> = {
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6 8.5 7 8.5-7" /></>,
    pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    file: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V3h8v4M3 12a20 20 0 0 0 18 0" /></>,
    building: <path d="M4 21V5h10v16M14 10h6v11M2 21h20M8 9h2M8 13h2M8 17h2M17 14h1M17 18h1" />,
    shield: <><path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Z" /><path d="m8 11 3 3 5-5" /></>,
    device: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    ban: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
    undo: <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />,
    pin: <><path d="M12 21s-7-6.3-7-12a7 7 0 0 1 14 0c0 5.7-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 11a3 3 0 1 0 0-6M21 20v-1a5 5 0 0 0-3.5-4.8" /></>,
    send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
    trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
    external: <path d="M14 3h7v7m0-7L10 14M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />,
    spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  };
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name]}</svg>;
}

export const number = (value: number) => new Intl.NumberFormat("en-KE").format(value);
export const date = (value: Date | string | null) => value ? new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—";
export const dateTime = (value: Date | string | null) => value ? new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
export function relative(value: Date | string | null) {
  if (!value) return "Never";
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months} month${months === 1 ? "" : "s"} ago` : `${Math.round(months / 12)} year${months < 18 ? "" : "s"} ago`;
}
export function freshness(value: Date | string | null) {
  if (!value) return "never";
  const days = (Date.now() - new Date(value).getTime()) / 86400000;
  return days <= 7 ? "fresh" : days <= 30 ? "recent" : "stale";
}
export function initials(name: string | null, email: string) { return ((name || email).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("") || "?").toUpperCase(); }
export function hue(text: string) { let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
export function Avatar({ name, email, large = false }: { name: string | null; email: string; large?: boolean }) {
  return <span className={`accounts-avatar${large ? " is-large" : ""}`} style={{ "--avatar-hue": hue(email) } as CSSProperties} aria-hidden="true">{initials(name, email)}</span>;
}
export function device(agent: string | null) {
  if (!agent) return "Unknown device";
  const browser = /Edg\//.test(agent) ? "Edge" : /OPR\//.test(agent) ? "Opera" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const os = /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Windows/.test(agent) ? "Windows" : /Mac OS/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "an unknown system";
  return `${browser} on ${os}`;
}
