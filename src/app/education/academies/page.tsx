import { EducationPage } from "@/components/education-page";
import { education } from "@/content/education";
export const metadata = { title: education["academies"].metaTitle };
export default function Page() { return <EducationPage slug="academies" />; }
