import type { CSSProperties } from "react";
import { accents, type Accent } from "@/lib/images";

// How a member appears to recruiters: used as the live preview on My profile and on applicant pages.
export type ProfileCardData = {
  name: string; headline: string | null; location: string | null; experienceYears: number | null;
  skills: string[]; openToWork: boolean; summary?: string | null; accent: string; photo: string | null;
  instagram: string | null; linkedin: string | null; website: string | null;
};

export const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "KB";
export const experienceText = (years: number | null) => years == null ? null : years === 0 ? "New to coffee" : years >= 20 ? "20+ years in coffee" : `${years} ${years === 1 ? "year" : "years"} in coffee`;

const Icon = ({ path }: { path: string }) => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
const icons = {
  pin: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  cup: "M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM16 9h2a2 2 0 0 1 0 4h-2M7 3v2M10 3v2M13 3v2",
  instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17.5 6.5h.01",
  linkedin: "M4 9h4v11H4zM6 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 9h4v1.6c.6-1 1.8-1.8 3.4-1.8 2.6 0 3.6 1.7 3.6 4.4V20h-4v-6c0-1.3-.4-2.2-1.6-2.2S14 12.8 14 14v6h-4z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z",
};

export function ProfileCard({ data, compact = false, preview = false }: { data: ProfileCardData; compact?: boolean; preview?: boolean }) {
  const theme = accents[(data.accent in accents ? data.accent : "espresso") as Accent];
  const meta = [data.location && { icon: icons.pin, text: data.location }, experienceText(data.experienceYears) && { icon: icons.cup, text: experienceText(data.experienceYears)! }].filter(Boolean) as { icon: string; text: string }[];
  const links = [
    data.instagram && { label: `@${data.instagram}`, href: `https://instagram.com/${data.instagram}`, icon: icons.instagram },
    data.linkedin && { label: "LinkedIn", href: data.linkedin, icon: icons.linkedin },
    data.website && { label: data.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), href: data.website, icon: icons.globe },
  ].filter(Boolean) as { label: string; href: string; icon: string }[];
  return <article className={`profile-card${compact ? " is-compact" : ""}`} style={{ "--card-from": theme.from, "--card-to": theme.to } as CSSProperties}>
    <div className="profile-card-banner">{data.openToWork && <span className="profile-card-open">Open to work</span>}</div>
    <div className="profile-card-body">
      <div className="profile-card-photo">{data.photo ? <img src={data.photo} alt="" /> : <span>{initialsOf(data.name)}</span>}</div>
      <h3>{data.name || "Your name"}</h3>
      {data.headline ? <p className="profile-card-headline">{data.headline}</p> : preview && <p className="profile-card-headline"><span className="is-empty">Add a headline, e.g. Head barista and latte art trainer</span></p>}
      {meta.length > 0 && <ul className="profile-card-meta">{meta.map(item => <li key={item.text}><Icon path={item.icon} />{item.text}</li>)}</ul>}
      {data.skills.length > 0 && <ul className="profile-card-skills" aria-label="Skills">{data.skills.map(skill => <li key={skill}>{skill}</li>)}</ul>}
      {!compact && data.summary && <p className="profile-card-summary">{data.summary.length > 220 ? `${data.summary.slice(0, 217)}…` : data.summary}</p>}
      {links.length > 0 && <ul className="profile-card-links">{links.map(link => <li key={link.href}><a href={link.href} target="_blank" rel="noopener noreferrer nofollow"><Icon path={link.icon} />{link.label}</a></li>)}</ul>}
    </div>
  </article>;
}
