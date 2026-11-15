import { LegacyGuidePage } from "@/components/legacy-guide-page";
import { ToolsLead } from "@/components/guide-leads";
export const metadata = { title: "Barista Tools & Techniques" };
export default function Page() { return <LegacyGuidePage slug="drinks" lead={<ToolsLead />} />; }
