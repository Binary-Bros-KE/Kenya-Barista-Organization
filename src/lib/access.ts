import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { getAuth } from "./auth";
import { assertAdmin, resolveActor } from "../server/access";
import { AccessError } from "../server/errors";

export async function pageActor(admin = false) {
  try {
    const actor = await resolveActor(getDb(), getAuth(), await headers());
    if (admin) assertAdmin(actor);
    return actor;
  } catch (error) {
    if (error instanceof AccessError) {
      if (error.code === "MFA_REQUIRED") redirect("/dashboard/security");
      if (error.status === 401) redirect("/sign-in");
      redirect("/access-denied");
    }
    throw error;
  }
}
