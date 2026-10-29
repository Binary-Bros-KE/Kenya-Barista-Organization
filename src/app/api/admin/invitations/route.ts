import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { sendMail } from "@/server/mail";
import { inviteEmployer } from "@/server/employers";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return api(request, async () => ({ invitations: await getDb().employerInvitation.findMany({ take: 50, orderBy: { createdAt: "desc" }, select: { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true, organisation: { select: { name: true } } } }) }), true);
}
export function POST(request: Request) {
  return api(request, async actor => inviteEmployer(getDb(), actor, await jsonInput(request), { baseURL: getEnv().APP_URL, deliver: sendMail }), true);
}
