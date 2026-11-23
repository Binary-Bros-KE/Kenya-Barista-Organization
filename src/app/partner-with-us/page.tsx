import { ContentPage } from "@/components/content-page";
import { PartnerForm } from "@/components/partner-form";
import { contactInfo } from "@/content/site-brand";
export const metadata = { title: "Partner with us", description: "Partner with Kenya Barista Organization to train, support and grow Kenya's barista community." };
export default function Page() {
  return <ContentPage title="Let's grow coffee together." eyebrow="PARTNER WITH KBO" intro="Cafés, roasters, suppliers, trainers and brands: work with us to support Kenya's baristas." className="content-contact">
    <div className="content-contact-layout"><PartnerForm/>
      <aside className="content-contact-details partner-aside"><span className="site-eyebrow">WHY PARTNER WITH KBO</span><h2>Reach the people behind the cup.</h2>
        <ul className="partner-reasons">
          <li><strong>Meet Kenya&apos;s baristas</strong><span>Connect with trained baristas, trainers and coffee lovers across our community.</span></li>
          <li><strong>Support the craft</strong><span>Help fund training, competitions and events that raise the standard of coffee in Kenya.</span></li>
          <li><strong>Grow your brand</strong><span>Partners are featured on our website and alongside our programmes.</span></li>
        </ul>
        <p className="partner-aside-note">Prefer email? Write to <a href={"mailto:" + contactInfo.email}>{contactInfo.email}</a>.</p>
      </aside></div>
  </ContentPage>;
}
