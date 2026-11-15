import { api } from "@/lib/api";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return api(request, async actor => ({
    user: { id: actor.user.id, name: actor.user.name, email: actor.user.email, role: actor.user.role, twoFactorEnabled: actor.user.twoFactorEnabled },
  }));
}
