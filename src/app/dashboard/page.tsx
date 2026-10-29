import Link from "next/link";
import { pageActor } from "@/lib/access";
export default async function Page() {
  const actor = await pageActor();
  return <><h1>Your account</h1><p className="intro">Welcome, {actor.user.name || "coffee professional"}.</p><div className="grid gap-5 sm:grid-cols-2"><div className="card"><h2>Verified email</h2><p className="mt-3 break-all text-stone-600">{actor.user.email}</p></div><div className="card"><h2>Account security</h2><p className="my-3 text-stone-600">{actor.user.twoFactorEnabled ? "Two-factor authentication enabled" : "Protect your account with an authenticator app"}</p><Link href="/dashboard/security">Manage security →</Link></div></div>{actor.user.role === "ADMIN" && <Link className="button mt-8" href="/admin">Open administration</Link>}</>;
}
