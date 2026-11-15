import { EducationPage } from "@/components/education-page";
import { education } from "@/content/education";
export const metadata = { title: education["coaching"].metaTitle };
export default function Page() { return <EducationPage slug="coaching" />; }
