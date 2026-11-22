import type { NextConfig } from "next";
import { version } from "./package.json";

function cloudName() {
  const url = process.env.CLOUDINARY_URL?.match(/^cloudinary:\/\/[^:]+:[^@]+@(.+)$/);
  return url?.[1] || process.env.CLOUDINARY_CLOUD_NAME || "";
}

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Shown in the workspace sidebar. Bump with `npm version patch|minor|major --no-git-tag-version`.
  // The Cloudinary cloud name and folder are public (they appear in every image URL); the API secret never leaves the server.
  env: { NEXT_PUBLIC_APP_VERSION: version, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: cloudName(), NEXT_PUBLIC_CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || "kbo" },
  async redirects() {
    return [
      { source: "/comparison", destination: "/origin-and-processes", permanent: true },
      { source: "/drinks", destination: "/barista-tools", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
