// Builds Cloudinary delivery URLs for profile photos and job covers. Safe in the browser:
// the cloud name and folder are public, and every image has a fixed public id per account or job.
export type ImageKind = "avatars" | "job-covers";

const cloud = () => process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const folder = () => process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER || "kbo";

export function imagePublicId(kind: ImageKind, id: string, base = folder()) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error("Invalid image owner id");
  return `${base}/${kind}/${id}`;
}

function src(kind: ImageKind, id: string, version: number | null | undefined, transform: string) {
  if (!version || !cloud()) return null;
  return `https://res.cloudinary.com/${cloud()}/image/upload/${transform},f_auto,q_auto/v${version}/${imagePublicId(kind, id)}`;
}

// Square, centred on the face. Ask for twice the display size so photos stay sharp on phones.
export const avatarSrc = (userId: string, version: number | null | undefined, size = 96) => src("avatars", userId, version, `c_fill,g_face,w_${size * 2},h_${size * 2}`);
export const coverSrc = (jobId: string, version: number | null | undefined, width = 1200, height = 440) => src("job-covers", jobId, version, `c_fill,g_auto,w_${width},h_${height}`);

// Profile card colours a member can pick.
export const accents = {
  espresso: { label: "Espresso", from: "#5a3a26", to: "#2f1f16" },
  teal: { label: "Teal", from: "#14a397", to: "#0b5f58" },
  gold: { label: "Crema", from: "#d7a446", to: "#9a6b1e" },
  rose: { label: "Berry", from: "#e0577a", to: "#8f1435" },
  forest: { label: "Forest", from: "#3b7d55", to: "#1f4a31" },
} as const;
export type Accent = keyof typeof accents;
