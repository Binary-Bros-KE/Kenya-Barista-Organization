"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicPhoto } from "@/lib/public-photo";
import { defaultHeroImage, pageHeroes } from "@/content/page-heroes";
export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
 const page = pageHeroes[usePathname() ?? ""];
 return <header className="page-hero"><img src={publicPhoto(page?.image || defaultHeroImage)} alt="" aria-hidden="true" fetchPriority="high"/><span className="page-hero-frame" aria-hidden="true"/><div className="page-hero-copy"><span className="page-hero-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{intro}</p>{page&&<nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li>{page.section&&<li>{page.section}</li>}<li aria-current="page">{page.label}</li></ol></nav>}</div></header>;
}
