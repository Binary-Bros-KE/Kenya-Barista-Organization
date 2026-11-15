import { redirect } from "next/navigation";
// Recruiters work from their job postings; there are no company workspaces.
export default function Page() { redirect("/employer/jobs"); }
