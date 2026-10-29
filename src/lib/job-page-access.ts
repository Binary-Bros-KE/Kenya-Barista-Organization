import "server-only";
import { pageActor } from "./access";
export async function jobPageActor(admin = false) {
  const actor = await pageActor(admin);
  return actor.user.role === "ADMIN" && !admin ? pageActor(true) : actor;
}
