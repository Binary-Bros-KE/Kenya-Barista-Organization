import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { getEnv } from "../lib/env";
import { logEvent } from "../lib/logger";
import { sendMail, type MailSender } from "./mail";

export type MailSettings = { baseURL: string; deliver: MailSender };
export const defaultMail = (): MailSettings => ({ baseURL: getEnv().APP_URL, deliver: sendMail });

export function notify(tx: Prisma.TransactionClient, data: { userId: string; kind: string; title: string; body: string; href: string; audience: "ACCOUNT" | "ADMIN" }) {
  return tx.notification.create({ data });
}

// Sends a branded email for a notification straight away and marks it sent, so the background
// worker doesn't email it again. If sending fails, the notification stays pending and the worker retries it.
export async function emailNow(db: PrismaClient, notificationId: string, to: string, email: { subject: string; text: string; html: string }, mail: MailSettings) {
  try {
    await mail.deliver({ to, ...email, messageId: `<notification-${notificationId}@${new URL(mail.baseURL).hostname}>` });
    await db.notification.updateMany({ where: { id: notificationId, deliveryStatus: "PENDING" }, data: { deliveryStatus: "SENT", sentAt: new Date(), lastError: null } });
  } catch {
    logEvent("warn", "instant_email.deferred_to_worker");
  }
}
