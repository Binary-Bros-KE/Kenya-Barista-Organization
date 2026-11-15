import { SiteFrame } from "./site-frame";
import { PageHero } from "./page-hero";
export function ContentPage({ title, eyebrow, intro, children, className = "" }: { title: string; eyebrow: string; intro: string; children: React.ReactNode; className?: string }) { return <SiteFrame><main id="main-content" tabIndex={-1} className="content-main"><PageHero eyebrow={eyebrow} title={title} intro={intro}/><div className={"content-page "+className}>{children}</div></main></SiteFrame>; }
