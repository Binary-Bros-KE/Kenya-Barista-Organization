import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { readImageBody, removeAvatar, setAvatar } from "@/server/images";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The signed-in person's profile photo. The body is the raw image file.
export function POST(request: Request) { return api(request, async actor => setAvatar(getDb(), actor, await readImageBody(request, "avatars"))); }
export function DELETE(request: Request) { return api(request, actor => removeAvatar(getDb(), actor)); }
