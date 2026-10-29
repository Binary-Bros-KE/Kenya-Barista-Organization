import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { LegacyEnquiry } from "@/components/legacy-enquiry";
import content from "@/content/legacy-site.json";
export const metadata = { title: "Course Registration" };
export default function Page() { return <PublicShell title="a rare experience in taste" fullWidth><main><h1 className="sr-only">Our Courses and Registration</h1><div className="legacy-courses"><img src={content.assets["https://ik.imagekit.io/qxekjpfx0b/KBO/courses_xfs8iQ-5p.jpg"]} alt="Kenya Barista Organization courses and modules" loading="lazy" /><img src={content.assets["https://ik.imagekit.io/qxekjpfx0b/KBO/jowam_iDzN1TSEvYNC.jpeg"]} alt="Jowam coffee training information" loading="lazy" /></div><div className="legacy-location"><p>Caxton Hse.</p><p>3rd Floor.</p><p>Standard Street Nairobi.</p></div><LegacyEnquiry course /><p className="text-center mb-10">Looking to apply for a job? <Link href="/register" className="underline">Create a job applicant account</Link>.</p></main></PublicShell>; }
