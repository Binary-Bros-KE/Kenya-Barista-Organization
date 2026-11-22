import { createHash } from "node:crypto";
import { getEnv } from "../lib/env";
import { logEvent } from "../lib/logger";
import { AccessError } from "./errors";

// The Cloudinary connection shared by photos (public images), CVs and database backups (private files).

export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string; folder: string };
export function cloudinaryConfig(env: Pick<ReturnType<typeof getEnv>, "CLOUDINARY_URL" | "CLOUDINARY_CLOUD_NAME" | "CLOUDINARY_API_KEY" | "CLOUDINARY_API_SECRET" | "CLOUDINARY_FOLDER"> = getEnv()): CloudinaryConfig | null {
  const url = env.CLOUDINARY_URL?.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  const [apiKey, apiSecret, cloudName] = url ? [url[1], url[2], url[3]] : [env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET, env.CLOUDINARY_CLOUD_NAME];
  return apiKey && apiSecret && cloudName ? { cloudName, apiKey, apiSecret, folder: env.CLOUDINARY_FOLDER } : null;
}

// Cloudinary's signature: the parameters sorted by name, joined as a query string, plus the API secret, SHA-1 hashed.
export function signParams(params: Record<string, string>, secret: string) {
  const query = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join("&");
  return createHash("sha1").update(query + secret).digest("hex");
}

const unavailable = () => new AccessError(502, "STORAGE_SERVICE_FAILED", "The file service didn't respond. Please try again in a moment.");
const signed = (config: CloudinaryConfig, params: Record<string, string>) => {
  const all = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
  return { ...all, api_key: config.apiKey, signature: signParams(all, config.apiSecret) };
};

// A signed call to the upload API (upload, destroy). Returns Cloudinary's JSON reply.
export async function cloudinaryCall(config: CloudinaryConfig, resource: "image" | "raw", action: "upload" | "destroy", params: Record<string, string>, file?: Buffer, request: typeof fetch = fetch) {
  const body = new FormData();
  for (const [key, value] of Object.entries(signed(config, params))) body.set(key, value);
  if (file) body.set("file", new Blob([new Uint8Array(file)]));
  const response = await request(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resource}/${action}`, { method: "POST", body, signal: AbortSignal.timeout(60000) }).catch(() => null);
  const data = response ? await response.json().catch(() => ({})) as { version?: number; result?: string; bytes?: number } : {};
  if (!response?.ok) { logEvent("warn", `cloudinary.${resource}_${action}_failed.${response?.status ?? "no_response"}`); throw unavailable(); }
  return data;
}

// Private files (CVs, backups): stored as raw files that have no public link; only the server can fetch them.
export function privateFiles(config: CloudinaryConfig, request: typeof fetch = fetch) {
  return {
    async put(publicId: string, bytes: Buffer) {
      const data = await cloudinaryCall(config, "raw", "upload", { public_id: publicId, type: "private", overwrite: "false" }, bytes, request);
      if (data.bytes !== bytes.length) throw unavailable();
    },
    async get(publicId: string): Promise<Buffer> {
      // A short-lived signed download link, used immediately by the server and never shown to anyone.
      const query = new URLSearchParams(signed(config, { public_id: publicId, type: "private", expires_at: String(Math.floor(Date.now() / 1000) + 300) }));
      const response = await request(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/raw/download?${query}`, { signal: AbortSignal.timeout(60000) }).catch(() => null);
      if (!response?.ok) { logEvent("warn", `cloudinary.raw_download_failed.${response?.status ?? "no_response"}`); throw Object.assign(unavailable(), { missing: response?.status === 404 }); }
      return Buffer.from(await response.arrayBuffer());
    },
    async remove(publicId: string) {
      const data = await cloudinaryCall(config, "raw", "destroy", { public_id: publicId, type: "private", invalidate: "true" }, undefined, request);
      if (data.result !== "ok" && data.result !== "not found") throw unavailable();
    },
    // Admin API listing (newest first is not guaranteed, so callers sort).
    async list(prefix: string) {
      const found: { publicId: string; createdAt: string; bytes: number }[] = [];
      let cursor = "";
      do {
        const query = new URLSearchParams({ type: "private", prefix, max_results: "500", ...(cursor ? { next_cursor: cursor } : {}) });
        const response = await request(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/resources/raw?${query}`, { headers: { Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}` }, signal: AbortSignal.timeout(60000) }).catch(() => null);
        if (!response?.ok) throw unavailable();
        const data = await response.json() as { resources: { public_id: string; created_at: string; bytes: number }[]; next_cursor?: string };
        found.push(...data.resources.map(item => ({ publicId: item.public_id, createdAt: item.created_at, bytes: item.bytes })));
        cursor = data.next_cursor ?? "";
      } while (cursor);
      return found;
    },
  };
}
export type PrivateFiles = ReturnType<typeof privateFiles>;
