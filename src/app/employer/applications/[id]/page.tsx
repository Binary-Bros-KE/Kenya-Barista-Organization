import { redirect } from "next/navigation";
import { jobPageActor } from "@/lib/job-page-access";
export const dynamic="force-dynamic";
// Applicants open in the same popup as My jobs, from the Applications tab; old links to this page land there.
export default async function Page({params}:{params:Promise<{id:string}>}){
 await jobPageActor();
 redirect("/employer/applications?open="+encodeURIComponent((await params).id));
}
