import Link from "next/link";
import { SiteFrame } from "./site-frame";
export function ContentPage({ title, eyebrow, intro, children, className = "" }: { title: string; eyebrow: string; intro: string; children: React.ReactNode; className?: string }) { return <SiteFrame><main id="main-content" tabIndex={-1} className={"content-page "+className}><header className="content-heading"><Link href="/" className="content-back">&larr; Back to home</Link><span className="site-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{intro}</p></header>{children}</main></SiteFrame>; }
