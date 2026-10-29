import { PublicShell } from "@/components/public-shell";
import content from "@/content/legacy-site.json";
export const metadata = { title: "Our Team" };
export default function Page() { return <PublicShell title="coffee for togetherness"><main className="legacy-team"><h1 className="legacy-section-heading">The Team</h1><div className="legacy-team-grid">{content.team.map((member, i) => <article key={member.name} className={i === 0 ? "legacy-team-lead" : ""}>{member.image ? <img src={member.image} alt={member.name} width={250} height={250} loading="lazy" /> : <div className="legacy-missing-image">Photo unavailable</div>}<h2>{member.name}</h2><p>{member.role}</p></article>)}</div></main></PublicShell>; }
