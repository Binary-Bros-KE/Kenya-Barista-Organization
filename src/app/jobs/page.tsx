import { CareerFrame, JobSearchContent } from "@/components/recruitment-public";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { listPublicJobs, publicJobFacets, publicJobQuery } from "@/server/public-jobs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Coffee jobs in Kenya", description: "Discover barista, roasting, hospitality, and other coffee career opportunities in Kenya." };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const result = publicJobQuery.safeParse(Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])));
  if (!result.success) return <CareerFrame><JobSearchContent query={{page:1}} data={null} organisations={[]} invalid/></CareerFrame>;
  const query = result.data;
  let data: Awaited<ReturnType<typeof listPublicJobs>> | null = null;
  let organisations: Awaited<ReturnType<typeof publicJobFacets>> = [];
  try { [data, organisations] = await Promise.all([listPublicJobs(getDb(), query), publicJobFacets(getDb())]); }
  catch { logEvent("error", "jobs.public_page_unavailable"); }
  return <CareerFrame><JobSearchContent query={query} data={data} organisations={organisations}/></CareerFrame>;
}
