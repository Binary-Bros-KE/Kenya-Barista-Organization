import { SiteFrame } from "./site-frame";
export { contactInfo, socialLinks } from "@/content/site-brand";
export function LegacyShell({ children, title = "let's talk coffee", guide = false, fullWidth = false, compact = false }: { children: React.ReactNode; title?: string; guide?: boolean; fullWidth?: boolean; compact?: boolean }) {
 return <SiteFrame><div className={"legacy-site site-inner-page"+(compact?" site-compact":"")}>{!compact&&<div className={"site-page-intro"+(guide?" is-guide":"")}><p>{title}</p><span>{guide?"THE KBO COFFEE GUIDE":"KENYA BARISTA ORGANIZATION"}</span></div>}<div id="main-content" tabIndex={-1} className={fullWidth?"legacy-content-wide":"legacy-content"}>{children}</div></div></SiteFrame>;
}
