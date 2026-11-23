import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { resolveActor } from "@/server/access";
import { notificationScope } from "@/server/notification-access";
export const dynamic = "force-dynamic";
// Who is signed in, for the public website header. Signed-out visitors get { user: null } rather than an error.
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" }, db = getDb();
  try {
    const { user } = await resolveActor(db, getAuth(), request.headers);
    const unread = await db.notification.count({ where: { ...notificationScope(user.id, user.role === "ADMIN"), readAt: null } });
    return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarVersion: user.avatarVersion, unread } }, { headers });
  } catch { return Response.json({ user: null }, { headers }); }
}
