import type { NextConfig } from "next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Shown in the workspace sidebar. Bump with `npm version patch|minor|major --no-git-tag-version`.
  env: { NEXT_PUBLIC_APP_VERSION: version },
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
