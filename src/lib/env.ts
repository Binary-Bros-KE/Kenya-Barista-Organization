import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url().refine(value => /^postgres(ql)?:\/\//.test(value), "PostgreSQL URL required").optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  AUTH_SECRET: z.preprocess(value => value === "" ? undefined : value, z.string().min(32).optional()),
  EMAIL_MODE: z.enum(["file", "smtp"]).default("file"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export function getEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.issues.map(issue => issue.path.join(".")).join(", ")}`);
  }
  const appUrl = new URL(result.data.APP_URL);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname);
  if (result.data.NODE_ENV === "production" && appUrl.protocol !== "https:" && !loopback) {
    throw new Error("APP_URL must use HTTPS in production");
  }
  return result.data;
}
