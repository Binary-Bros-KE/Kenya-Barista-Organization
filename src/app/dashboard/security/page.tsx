import { pageActor } from "@/lib/access";
import { MfaForm } from "@/components/mfa-form";
export default async function Page() {
  const actor = await pageActor();
  return <><h1>Account security</h1><p className="intro">{actor.user.role === "ADMIN" ? "Administrators must verify two-factor authentication before opening administration." : "Add another layer of protection to your account."}</p><MfaForm enabled={actor.user.twoFactorEnabled} verified={Boolean(actor.session.mfaVerifiedAt)} /></>;
}
