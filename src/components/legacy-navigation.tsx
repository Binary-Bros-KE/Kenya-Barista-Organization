"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
const links = [["Philosophy", "/philosophy"], ["Team", "/team"], ["Gallery", "/gallery"], ["Registration", "/registration"], ["Contact Us", "/contact"]];
const guides = [["Coffee Farming", "/farming"], ["Arabica vs Robusta", "/comparison"], ["Bean to Cup", "/bean"], ["Types of Coffee Drinks", "/drinks"]];
export function LegacyNavigation() {
  const pathname = usePathname(), [fixed, setFixed] = useState(false), drawer = useRef<HTMLDetailsElement>(null);
  useEffect(() => { const scroll = () => setFixed(window.scrollY > 50); scroll(); window.addEventListener("scroll", scroll, { passive: true }); return () => window.removeEventListener("scroll", scroll); }, []);
  useEffect(() => { if (drawer.current) drawer.current.open = false; }, [pathname]);
  const render = (items: string[][]) => items.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>);
  return <div className="legacy-nav-space"><nav className={`legacy-nav${fixed ? " legacy-nav-fixed" : ""}`} aria-label="Main navigation">
    <Link href="/" className="legacy-brand-logo" aria-label="Kenya Barista Organization home"><img src="/brand-logo.png" alt="Kenya Barista Organization" width={48} height={47} /></Link>
    <div className="legacy-desktop-links">{render(links)}<details className="legacy-guide-menu"><summary>Barista Guide ⌄</summary><div>{render(guides)}</div></details>{render([["Jobs", "/jobs"], ["My account", "/dashboard"]])}</div>
    <details ref={drawer} className="legacy-mobile-menu" onKeyDown={event => { if (event.key === "Escape" && drawer.current) { drawer.current.open = false; drawer.current.querySelector("summary")?.focus(); } }}><summary aria-label="Open navigation menu">☰</summary><div className="legacy-drawer"><img src="/brand-logo.png" alt="Kenya Barista Organization" width={100} height={100} />{render([["Home", "/"], ...links, ...guides, ["Jobs", "/jobs"], ["My account", "/dashboard"], ["Sign in", "/sign-in"]])}</div></details>
  </nav></div>;
}
