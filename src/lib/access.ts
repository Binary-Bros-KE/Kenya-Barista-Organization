import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { getAuth } from "./auth";
import { assertAdmin, resolveActor } from "../server/access";
import { applicationReturnPath, authDestination } from "./auth-destination";
import { AccessError } from "../server/errors";

export async function pageActor(admin = false, returnTo?: string) {
  try {
    const actor = await resolveActor(getDb(), getAuth(), await headers());
    if (admin) assertAdmin(actor);
    return actor;
  } catch (error) {
    if (error instanceof AccessError) {
      if (error.code === "MFA_REQUIRED") redirect("/dashboard/security");
      if (error.status === 401) redirect(authDestination("/sign-in",applicationReturnPath(returnTo)));
      redirect("/access-denied");
    }
    throw error;
  }
}
