import Link from "next/link";
import type { ReactNode } from "react";
import { ContentPage } from "./content-page";
import { LegacyArticle } from "./legacy-article";
import guides from "@/content/legacy-guides.json";
const guideInfo = {
 farming: { href: "/farming", title: "Coffee farming", intro: "Explore coffee farming in Kenya, varieties, growing conditions and the journey behind the bean." },
 comparison: { href: "/origin-and-processes", title: "Origin and processes", intro: "Where coffee grows, how it is picked and how it is processed all shape the cup. Start with Kenya, then meet the two species behind most of the world's coffee." },
 bean: { href: "/bean", title: "From bean to cup", intro: "Follow coffee's journey from planting and harvesting to roasting, brewing and the cup in your hands." },
 drinks: { href: "/barista-tools", title: "Barista tools & techniques", intro: "Meet the tools behind the coffee bar, from grinder to gooseneck kettle, then put them to work with espresso, milk and the classic coffee drinks." },
};
export function LegacyGuidePage({slug,lead}:{slug:keyof typeof guides;lead?:ReactNode}){const article=guides[slug],info=guideInfo[slug];return <ContentPage title={info.title} eyebrow="THE KBO BARISTA HUB" intro={info.intro} className="content-guide"><div className="content-guide-layout"><aside className="content-guide-sidebar"><nav aria-label="Barista hub articles"><span className="site-eyebrow">EXPLORE THE HUB</span>{Object.values(guideInfo).map((value,i)=><Link href={value.href} key={value.href} aria-current={info.href===value.href?"page":undefined}><span>0{i+1}</span>{value.title}</Link>)}</nav><div><h2>Keep learning.</h2><p>Ready to build your skills? Explore online courses, academy training and coaching with KBO.</p><Link className="site-text-link" href="/education/online-courses">Explore education &#8594;</Link></div></aside><article className="content-guide-article">{lead}<div className="content-guide-note"><span>COFFEE KNOWLEDGE</span><p>{article.title}</p></div><LegacyArticle html={article.html}/><footer><Link href="/contact">Have a coffee question? Talk to KBO &#8594;</Link></footer></article></div></ContentPage>;}
