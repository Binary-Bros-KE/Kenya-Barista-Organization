import Link from "next/link";
import { publicPhoto } from "@/lib/public-photo";
import { ContentPage } from "./content-page";
import { education, type EducationSlug } from "@/content/education";
import { educationLinks } from "@/content/site-brand";
export function EducationPage({ slug }: { slug: EducationSlug }) {
 const page = education[slug], others = educationLinks.filter(([, href]) => href !== "/education/" + slug);
 return <ContentPage title={page.title} eyebrow={page.eyebrow} intro={page.intro} className="content-education">
  <section className="content-course-intro"><div><span className="site-eyebrow">{page.lead.eyebrow}</span><h2>{page.lead.heading}</h2><p>{page.lead.text}</p><ul className="content-module-list" aria-label={page.lead.listLabel}>{page.lead.list.map((item, i) => <li key={item}><span>0{i + 1}</span>{item}</li>)}</ul><a className="site-button" href="#education-enquiry">Ask about this <span aria-hidden="true">&#8595;</span></a></div><figure><img src={publicPhoto(page.photo.src)} alt={page.photo.alt} width={page.photo.width} height={page.photo.height} loading="lazy"/><figcaption>{page.photo.caption}</figcaption></figure></section>
  <section className="content-education-options"><div className="content-section-heading"><span className="site-eyebrow">YOUR OPTIONS</span><h2>{page.options.heading}</h2><p>{page.options.text}</p></div><div className="content-course-options is-three">{page.options.items.map(([eyebrow, title, text]) => <article key={title}><span className="site-eyebrow">{eyebrow}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
  <section className="content-values"><div className="content-section-heading"><span className="site-eyebrow">HOW IT WORKS</span><h2>Three simple steps.</h2></div><div>{page.steps.map(([title, text], i) => <article key={title}><header><span>{String(i + 1).padStart(2, "0")}</span></header><h3>{title}</h3><p>{text}</p></article>)}</div></section>
  <section id="education-enquiry" className="content-community-note"><div><span className="site-eyebrow">READY WHEN YOU ARE</span><h2>{page.enquiry.heading}</h2><p>Send KBO a quick enquiry. We will confirm current availability, dates and fees before you commit.</p><ul className="content-education-links">{others.map(([label, href]) => <li key={href}><Link href={href}>Explore {label.toLowerCase()} &#8594;</Link></li>)}{page.enquiry.extra && <li><Link href={page.enquiry.extra[1]}>{page.enquiry.extra[0]} &#8594;</Link></li>}</ul></div><Link className="site-button" href="/registration#course-enquiry">Make an enquiry <span aria-hidden="true">&#8599;</span></Link></section>
 </ContentPage>;
}
