import { SocialMark } from "@/components/legacy-social-mark";
import { PublicShell } from "@/components/public-shell";
import { contactInfo, socialLinks } from "@/components/legacy-shell";
import { LegacyEnquiry } from "@/components/legacy-enquiry";
import content from "@/content/legacy-site.json";
export const metadata = { title: "Contact Us" };
export default function Page() { return <PublicShell title="the best artisans of coffee"><main><h1 className="sr-only">Contact Us</h1><div className="legacy-contact"><LegacyEnquiry /><section><h2 className="text-center mb-8">Contact Info</h2><p>{contactInfo.address}</p><p>{contactInfo.city}</p><p>Tel: <a href={`tel:${contactInfo.phone}`}>+254 72 463 7787</a></p><p>Email: <a href={`mailto:${contactInfo.email}`}>{contactInfo.email}</a></p><h3 className="mt-8 mb-5">Social Media Platforms</h3><div className="legacy-socials">{socialLinks.map(([label, href]) => <a href={href} key={label}><SocialMark name={label} /><span className="sr-only">{label}</span></a>)}</div><p>Follow, Join, Like, Subscribe</p><img src={content.assets["https://ik.imagekit.io/qxekjpfx0b/KBO/contact_x9bSUfu0xB.jpg"]} alt="Coffee at Kenya Barista Organization" loading="lazy" /></section></div></main></PublicShell>; }
