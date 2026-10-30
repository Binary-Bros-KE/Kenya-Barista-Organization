
import Link from "next/link";
import {ContentPage} from "@/components/content-page";
export default function NotFound(){return <ContentPage eyebrow="PAGE NOT FOUND" title="Let's find your way back." intro="This link may have changed, or the opportunity may no longer be available."><div className="career-state"><h2>There's more to explore.</h2><p>Browse current coffee opportunities or return to the Kenya Barista homepage.</p><div className="polish-recovery-actions"><Link href="/jobs" className="site-button">Explore opportunities &#8594;</Link><Link href="/" className="site-text-link">Back to home &#8594;</Link></div></div></ContentPage>;}
