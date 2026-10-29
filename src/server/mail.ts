import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, link, unlink } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { getEnv } from "../lib/env";

export type MailMessage = { to: string; subject: string; text: string; messageId?: string };
export type MailSender = (message: MailMessage) => Promise<void>;

export function validateMailConfiguration() {
  const env = getEnv();
  if (env.EMAIL_MODE === "file") {
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(env.APP_URL).hostname);
    if (env.NODE_ENV === "production" || !local) throw new Error("Development email files are restricted to local development. Configure SMTP.");
  } else {
    if (!env.SMTP_HOST || !env.SMTP_FROM || Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) {
      throw new Error("SMTP_HOST, SMTP_FROM, and matching SMTP authentication settings are required");
    }
  }
  return env;
}

export const sendMail: MailSender = async message => {
  const env = validateMailConfiguration();
  if (env.EMAIL_MODE === "file") {
    const directory = path.join(process.cwd(), ".dev-mail");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const filename = message.messageId ? `notification-${createHash("sha256").update(message.messageId).digest("hex")}.json` : `${Date.now()}-${randomUUID()}.json`;
    const temporary = path.join(directory, `.tmp-${randomUUID()}`);
    try {
      await writeFile(temporary, JSON.stringify({ ...message, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600, flag: "wx" });
      // Linking the completed file makes stable-ID previews atomic and safe under concurrent retries.
      try { await link(temporary, path.join(directory, filename)); }
      catch (error) { if (!(message.messageId && (error as NodeJS.ErrnoException).code === "EEXIST")) throw error; }
    } finally { await unlink(temporary).catch(() => {}); }
    return;
  }
  const secure = env.SMTP_SECURE === "true";
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port: env.SMTP_PORT, secure, requireTLS: !secure,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000, greetingTimeout: 10000, dnsTimeout: 10000, socketTimeout: 15000,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const info = await Promise.race([
      transport.sendMail({ from: env.SMTP_FROM, ...message }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { transport.close(); reject(new Error("Mail delivery timed out")); }, 45000); }),
    ]);
    if (!info.accepted?.length || info.rejected?.length) throw new Error("Mail recipient was not accepted");
  } finally { if (timer) clearTimeout(timer); transport.close(); }
};
