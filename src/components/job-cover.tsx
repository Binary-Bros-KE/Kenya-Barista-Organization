import type { CSSProperties } from "react";
import { coverSrc } from "@/lib/images";

// A job's cover: the uploaded photo, or a branded cover coloured by category.
const palettes: Record<string, [string, string]> = {
  BARISTA: ["#6b4329", "#2f1f16"], ROASTING: ["#a4442a", "#4a1a10"], HOSPITALITY: ["#14a397", "#0b5f58"],
  TRAINING: ["#d7a446", "#8a5d16"], MANAGEMENT: ["#3b7d55", "#1f4a31"], OTHER: ["#5d6b78", "#2b333b"],
};

export function JobCover({ id, coverVersion, category, size = "card", className = "" }: { id: string; coverVersion: number | null; category: string; size?: "card" | "hero"; className?: string }) {
  const [from, to] = palettes[category] ?? palettes.OTHER;
  const photo = size === "hero" ? coverSrc(id, coverVersion, 1600, 520) : coverSrc(id, coverVersion, 720, 300);
  return <div className={`job-cover is-${size}${photo ? " has-photo" : ""} ${className}`.trim()} style={{ "--cover-from": from, "--cover-to": to } as CSSProperties} aria-hidden="true">
    {photo ? <img src={photo} alt="" loading={size === "hero" ? "eager" : "lazy"} /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM16 9h2a2 2 0 0 1 0 4h-2M7 3v2M10 3v2M13 3v2" /></svg>}
  </div>;
}
