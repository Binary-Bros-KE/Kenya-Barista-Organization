import { PublicShell } from "@/components/public-shell";
import content from "@/content/legacy-site.json";
export const metadata = { title: "Our Philosophy" };
export default function Page() {
  return <PublicShell title="experience love at first sip" fullWidth><main><h1 className="sr-only">Our Philosophy</h1><section className="legacy-founded"><p>The KENYA BARISTA ORGANIZATION was founded in 14 JUNE 2014 as a Barista Organization. It has a 7 Board of Directors voted and selected by Members. The Board of Directors include:</p><ul>{["The Chairman", "The Deputy Chair Person", "The Chief Executive Officer", "The Secretary General", "The Treasurer", "Board Members(s) (maximum of 2)"].map(text => <li key={text}>{text}</li>)}</ul><p>* All serving under the interest of Kenya Barista Organization while protecting and defending the Constitution of K.B.O</p><h2>Core Values</h2></section><section className="legacy-values">{content.philosophy.values.map(value => <article key={value.title}><h3>{value.title}</h3>{value.src && <img src={value.src} alt="" loading="lazy" />}<p>{value.text}</p></article>)}</section></main></PublicShell>;
}
