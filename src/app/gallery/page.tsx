import { PublicShell } from "@/components/public-shell";
import { LegacyGallery } from "@/components/legacy-gallery";
import content from "@/content/legacy-site.json";
export const metadata = { title: "Gallery" };
export default function Page() { return <PublicShell title="get up! get coffee! be happy!" fullWidth><main><h1 className="legacy-section-heading">Photo Gallery</h1><LegacyGallery photos={content.gallery} /><h2 className="legacy-section-heading">Products For Sale</h2><p className="text-center">Coming Soon!</p><div className="legacy-shop">{content.shop.map((item, i) => <article key={i}>{item.src && <a href={item.src}><img src={item.src} alt={item.alt} loading="lazy" /></a>}<h3>{item.alt}</h3><p>@kenyabaristaorg</p></article>)}</div></main></PublicShell>; }
