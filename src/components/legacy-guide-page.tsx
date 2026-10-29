import { PublicShell } from "./public-shell";
import { LegacyArticle } from "./legacy-article";
import guides from "@/content/legacy-guides.json";
export function LegacyGuidePage({ slug }: { slug: keyof typeof guides }) { const article = guides[slug]; return <PublicShell title={article.title} guide fullWidth><main><LegacyArticle html={article.html} /></main></PublicShell>; }
