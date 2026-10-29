import { pageActor } from "@/lib/access";
import { SecurityOverview } from "@/components/security-overview";
export default async function Page() {
 const actor = await pageActor();
 return <SecurityOverview admin={actor.user.role === "ADMIN"} enabled={actor.user.twoFactorEnabled} verified={Boolean(actor.session.mfaVerifiedAt)} email={actor.user.email}/>;
}
