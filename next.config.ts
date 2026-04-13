import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; don't try to bundle it.
  serverExternalPackages: ["better-sqlite3"],
  // We run this purely on localhost — no image CDN optimisation needed.
  images: { unoptimized: true },
};

export default nextConfig;
