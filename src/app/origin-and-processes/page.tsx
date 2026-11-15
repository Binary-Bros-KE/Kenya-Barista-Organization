import { LegacyGuidePage } from "@/components/legacy-guide-page";
import { OriginLead } from "@/components/guide-leads";
export const metadata = { title: "Origin and Processes" };
export default function Page() { return <LegacyGuidePage slug="comparison" lead={<OriginLead />} />; }
