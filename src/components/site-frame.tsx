import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
export function SiteFrame({ children }: { children: React.ReactNode }) { return <div className="site-public" id="top"><a className="site-skip" href="#main-content">Skip to content</a><SiteHeader/>{children}<SiteFooter/></div>; }
