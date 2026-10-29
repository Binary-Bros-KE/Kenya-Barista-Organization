import "server-only";
import { after } from "next/server";
import { getAuth as coreAuth } from "../server/auth";
import { sendMail } from "../server/mail";
import { logEvent } from "./logger";

export function getAuth() {
  return coreAuth(async message => {
    // Keep SMTP latency out of account-existence responses. Next retains this
    // task after the response. Token emails use this direct path; job and
    // application updates use the separate durable notification worker.
    after(async () => {
      try { await sendMail(message); }
      catch { logEvent("error", "auth.email_delivery_failed"); }
    });
  });
}
