
import Link from "next/link";
import {ContentPage} from "@/components/content-page";
export default function Page(){return <ContentPage eyebrow="ACCOUNT ACCESS" title="This area isn't available to your account." intro="Contact the organisation administrator if you need access to this workspace."><div className="career-state"><h2>Let's get you back on track.</h2><p>You can return to your account or explore public opportunities.</p><div className="polish-recovery-actions"><Link href="/dashboard" className="site-button">Return to your account &#8594;</Link><Link href="/jobs" className="site-text-link">Browse coffee jobs &#8594;</Link></div></div></ContentPage>;}
