import { createHash } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client";
import { getEnv } from "../lib/env";
import { imagePublicId, type ImageKind } from "../lib/images";
import { logEvent } from "../lib/logger";
import type { Actor } from "./access";
import { AccessError } from "./errors";

// Uploads go through the server: it checks the file really is an image, then sends it to Cloudinary
// with a signed request. Each account or job has one fixed public id, so a new photo replaces the old one.

export const IMAGE_LIMITS: Record<ImageKind, { bytes: number; label: string; incoming: string }> = {
  avatars: { bytes: 5 * 1024 * 1024, label: "5 MB", incoming: "c_limit,w_1024,h_1024" },
  "job-covers": { bytes: 8 * 1024 * 1024, label: "8 MB", incoming: "c_limit,w_2400,h_2400" },
};

export type ImageStore = {
  folder: string;
  upload(publicId: string, bytes: Buffer, kind: ImageKind): Promise<{ version: number }>;
  remove(publicId: string): Promise<void>;
};

type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string; folder: string };
export function cloudinaryConfig(env = getEnv()): CloudinaryConfig | null {
  const url = env.CLOUDINARY_URL?.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  const [apiKey, apiSecret, cloudName] = url ? [url[1], url[2], url[3]] : [env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET, env.CLOUDINARY_CLOUD_NAME];
  return apiKey && apiSecret && cloudName ? { cloudName, apiKey, apiSecret, folder: env.CLOUDINARY_FOLDER } : null;
}

// Cloudinary's signature: the parameters sorted by name, joined as a query string, plus the API secret, SHA-1 hashed.
export function signParams(params: Record<string, string>, secret: string) {
  const query = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join("&");
  return createHash("sha1").update(query + secret).digest("hex");
}

export function cloudinaryStore(config: CloudinaryConfig, request: typeof fetch = fetch): ImageStore {
  const endpoint = (action: string) => `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/${action}`;
  async function call(action: string, params: Record<string, string>, file?: Buffer) {
    const signed = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
    const body = new FormData();
    for (const [key, value] of Object.entries(signed)) body.set(key, value);
    body.set("api_key", config.apiKey);
    body.set("signature", signParams(signed, config.apiSecret));
    if (file) body.set("file", new Blob([new Uint8Array(file)]));
    const response = await request(endpoint(action), { method: "POST", body, signal: AbortSignal.timeout(30000) }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) as { version?: number; result?: string; error?: { message?: string } } : {};
    if (!response?.ok) {
      logEvent("warn", `cloudinary.${action}_failed.${response?.status ?? "no_response"}`);
      throw new AccessError(502, "IMAGE_SERVICE_FAILED", "The photo service didn't respond. Please try again in a moment.");
    }
    return data;
  }
  return {
    folder: config.folder,
    async upload(publicId, bytes, kind) {
      const data = await call("upload", { public_id: publicId, overwrite: "true", invalidate: "true", transformation: IMAGE_LIMITS[kind].incoming }, bytes);
      if (typeof data.version !== "number") throw new AccessError(502, "IMAGE_SERVICE_FAILED", "The photo service didn't respond. Please try again in a moment.");
      return { version: data.version };
    },
    async remove(publicId) { await call("destroy", { public_id: publicId, invalidate: "true" }); },
  };
}

export function defaultImageStore(): ImageStore {
  const config = cloudinaryConfig();
  if (!config) throw new AccessError(503, "IMAGES_DISABLED", "Photo uploads aren't set up yet. Please try again later.");
  return cloudinaryStore(config);
}
export const imagesEnabled = () => cloudinaryConfig() !== null;

// Checks the first bytes, not the file name or the browser's claimed type.
export function sniffImage(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) return "png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "webp";
  return null;
}

export function checkImage(bytes: Buffer, kind: ImageKind) {
  if (!bytes.length) throw new AccessError(400, "EMPTY_FILE", "Choose a photo first");
  if (bytes.length > IMAGE_LIMITS[kind].bytes) throw new AccessError(413, "INVALID_SIZE", `Choose a photo up to ${IMAGE_LIMITS[kind].label}`);
  if (!sniffImage(bytes)) throw new AccessError(415, "IMAGE_REQUIRED", "Choose a JPG, PNG or WebP photo");
}

// Reads a raw image request body, stopping as soon as it passes the size limit.
export async function readImageBody(request: Request, kind: ImageKind) {
  const reader = request.body?.getReader();
  if (!reader) throw new AccessError(400, "EMPTY_FILE", "Choose a photo first");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > IMAGE_LIMITS[kind].bytes) { await reader.cancel(); throw new AccessError(413, "INVALID_SIZE", `Choose a photo up to ${IMAGE_LIMITS[kind].label}`); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function setAvatar(db: PrismaClient, actor: Actor, bytes: Buffer, store: ImageStore = defaultImageStore()) {
  checkImage(bytes, "avatars");
  const { version } = await store.upload(imagePublicId("avatars", actor.user.id, store.folder), bytes, "avatars");
  await db.user.update({ where: { id: actor.user.id }, data: { avatarVersion: version } });
  await db.auditLog.create({ data: { actorId: actor.user.id, action: "profile.photo_changed", entityType: "User", entityId: actor.user.id } });
  return { avatarVersion: version };
}

export async function removeAvatar(db: PrismaClient, actor: Actor, store: ImageStore = defaultImageStore()) {
  const result = await db.user.updateMany({ where: { id: actor.user.id, avatarVersion: { not: null } }, data: { avatarVersion: null } });
  if (!result.count) throw new AccessError(404, "NOT_FOUND", "You don't have a profile photo");
  await db.auditLog.create({ data: { actorId: actor.user.id, action: "profile.photo_removed", entityType: "User", entityId: actor.user.id } });
  // The photo is already hidden; if Cloudinary is briefly unreachable the file is simply replaced next time.
  await store.remove(imagePublicId("avatars", actor.user.id, store.folder)).catch(() => logEvent("warn", "cloudinary.remove_deferred"));
  return { avatarVersion: null };
}
