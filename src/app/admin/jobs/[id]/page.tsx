import { ManagedJobPage } from "@/components/managed-job-page";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <ManagedJobPage id={(await params).id} admin />; }
