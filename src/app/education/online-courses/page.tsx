import { EducationPage } from "@/components/education-page";
import { education } from "@/content/education";
export const metadata = { title: education["online-courses"].metaTitle };
export default function Page() { return <EducationPage slug="online-courses" />; }
