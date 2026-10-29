import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { applicantPayments } from "@/server/applicant-payments";
import { PaymentHistory } from "@/components/payment-history";
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
 const actor = await pageActor(); return <PaymentHistory result={await applicantPayments(getDb(), actor, await searchParams)} />;
}
