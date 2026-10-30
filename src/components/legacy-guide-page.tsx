import Link from "next/link";
import { ContentPage } from "./content-page";
import { LegacyArticle } from "./legacy-article";
import guides from "@/content/legacy-guides.json";
const guideInfo = {
 farming: { title: "Coffee farming", intro: "Explore coffee farming in Kenya, varieties, growing conditions and the journey behind the bean." },
 comparison: { title: "Arabica vs Robusta", intro: "Get to know the origins, growing conditions and characteristics of two familiar names in coffee." },
 bean: { title: "From bean to cup", intro: "Follow coffee's journey from planting and harvesting to roasting, brewing and the cup in your hands." },
 drinks: { title: "Coffee drinks & techniques", intro: "Explore espresso, milk steaming, coffee drinks and the everyday techniques behind the coffee bar." },
};
export function LegacyGuidePage({slug}:{slug:keyof typeof guides}){const article=guides[slug],info=guideInfo[slug];return <ContentPage title={info.title} eyebrow="THE KBO COFFEE GUIDE" intro={info.intro} className="content-guide"><div className="content-guide-layout"><aside className="content-guide-sidebar"><nav aria-label="Coffee guide articles"><span className="site-eyebrow">EXPLORE THE GUIDE</span>{Object.entries(guideInfo).map(([key,value],i)=><Link href={"/"+key} key={key} aria-current={slug===key?"page":undefined}><span>0{i+1}</span>{value.title}</Link>)}</nav><div><h2>Keep learning.</h2><p>Interested in developing your coffee skills? Explore course information and enquire with KBO.</p><Link className="site-text-link" href="/registration">Explore courses &#8594;</Link></div></aside><article className="content-guide-article"><div className="content-guide-note"><span>COFFEE KNOWLEDGE</span><p>{article.title}</p></div><LegacyArticle html={article.html}/><footer><Link href="/contact">Have a coffee question? Talk to KBO &#8594;</Link></footer></article></div></ContentPage>;}
