import { publicPhoto } from "@/lib/public-photo";
import { LegacyGallery } from "./legacy-gallery";
import content from "@/content/legacy-site.json";
const originFacts = [
 ["Where it grows", "The slopes of Mount Kenya and the Aberdares (Nyeri, Kirinyaga, Murang'a, Kiambu, Embu, Meru), with smaller regions around Mount Elgon, Kisii and Nakuru."],
 ["Altitude", "Mostly between 1,400 and 2,100 metres. Cool nights slow the cherry's ripening and build sweetness and acidity."],
 ["Varieties", "SL28 and SL34 are the classics. Ruiru 11 and Batian were bred in Kenya for disease resistance, and K7 suits lower-altitude farms."],
 ["Who grows it", "Most Kenyan coffee comes from smallholder farmers, who deliver ripe cherry to cooperative factories for processing."],
];
const processes = [
 ["01", "Washed", "Kenya's signature. The cherry is pulped, fermented to loosen the sticky mucilage, washed clean in channels, often soaked, then dried on raised beds.", "Clean, bright and juicy: think blackcurrant, citrus and a sparkling acidity."],
 ["02", "Natural", "The whole cherry is dried in the sun, fruit and all, and turned often so it dries evenly. The skin and pulp come off only once it is dry.", "Heavier body and fruit-forward sweetness, sometimes with winey or berry notes."],
 ["03", "Honey", "The skin is removed but some of the mucilage is left on the bean while it dries. More mucilage means a darker \"honey\" and a sweeter cup.", "A middle ground: rounder and sweeter than washed, cleaner than natural."],
];
const grades = [["AA", "The largest beans"], ["AB", "Large to medium beans"], ["PB", "Peaberry: a single, round bean in the cherry"], ["C", "Smaller beans"], ["E", "Elephant: very large, often paired beans"], ["TT / T", "Light and fragmented beans"]];
export function OriginLead() {
 return <section className="content-guide-lead" aria-labelledby="origin-lead-title"><div className="content-guide-lead-intro"><div><span className="site-eyebrow">THE KENYAN ORIGIN</span><h2 id="origin-lead-title">Grown high. Washed with care.</h2><p>Volcanic soil, high altitude and two rainy seasons give many Kenyan farms two harvests a year: the main crop and a smaller early crop, often called the fly crop. What happens in the days after picking matters as much as where the coffee grew.</p></div><figure><img src={publicPhoto("/legacy/e66ded7604318e85.jpg")} alt="Rows of coffee trees on a farm in the morning mist" width={1152} height={864} loading="lazy"/></figure></div>
 <dl className="content-guide-facts">{originFacts.map(([term,text])=><div key={term}><dt>{term}</dt><dd>{text}</dd></div>)}</dl>
 <h3 className="content-guide-subheading">Three ways to process a cherry</h3><div className="content-process-grid">{processes.map(([number,title,text,cup])=><article key={title}><span>{number}</span><h4>{title}</h4><p>{text}</p><p><strong>In the cup:</strong> {cup}</p></article>)}</div>
 <h3 className="content-guide-subheading">From parchment to grade</h3><p className="content-guide-lead-text">After drying, the coffee rests in its parchment before a dry mill hulls, sorts and grades it. Kenyan grades are mainly about bean size and density. The grade says nothing about flavour on its own: a great PB can outshine an ordinary AA.</p><ul className="content-grade-list">{grades.map(([grade,text])=><li key={grade}><strong>{grade}</strong><span>{text}</span></li>)}</ul></section>;
}
const toolGroups = [
 ["THE ESPRESSO STATION", "Espresso", "A consistent shot starts with a fresh grind, an even bed of coffee and a level tamp.", ["Espresso Machine", "Coffee Grinder", "Tamper", "The OCD", "Wooden Knockbox", "Head Brush"]],
 ["THE MILK STATION", "Milk & the bar", "Steaming jugs in a couple of sizes, plus the small extras behind every signature drink.", ["Steaming Jugs", "Pitchers", "Bar Spoon", "Shaker", "Syrups", "Sauces"]],
 ["THE BREW BAR", "Filter brewing", "Pour-over and immersion brewers, with the papers and kettle that give you control of every pour.", ["Hario V60", "Kalita", "Aeropress", "Clear Plunger", "Gooseneck Kettle", "Filter Papers"]],
 ["MEASURE & SERVE", "Measure & serve", "Good baristas weigh, not guess. Then they serve the cup with the same care.", ["Coffee Scale", "Scoop", "Grinder Brush", "Coffee Cup", "Clear cups", "Salt Rimmer"]],
] as const;
const careSteps = ["Purge and wipe the steam wand after every jug of milk.", "Flush the group head between shots and backflush at the end of the day.", "Brush out the grinder daily and clean the burrs regularly.", "Use filtered water: it protects the machine and the taste of your coffee."];
export function ToolsLead() {
 const photo = (alt: string) => content.shop.find(item => item.alt === alt);
 return <section className="content-guide-lead" aria-labelledby="tools-lead-title"><div className="content-guide-lead-intro is-text"><div><span className="site-eyebrow">TOOLS OF THE TRADE</span><h2 id="tools-lead-title">Know your tools. Trust your hands.</h2><p>Every barista works with the same handful of tools. Learn what each one does and how to look after it, and you can work confidently behind almost any bar. Open a photo for a closer look.</p></div></div>
 {toolGroups.map(([eyebrow,title,text,items])=><div className="content-tool-group" key={title}><header><span className="site-eyebrow">{eyebrow}</span><h3>{title}</h3><p>{text}</p></header><LegacyGallery photos={items.map(photo).filter(item=>item!==undefined)} label={title+" tools viewer"} showCaptions/></div>)}
 <aside className="content-tool-care"><h3>Look after your tools</h3><ul>{careSteps.map(step=><li key={step}>{step}</li>)}</ul></aside>
 <h3 className="content-guide-subheading">Put your tools to work</h3><p className="content-guide-lead-text">Below: how to pull a great espresso, steam milk and build the classic coffee drinks.</p></section>;
}
