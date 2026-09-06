import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "epub-gen-memory", "sharp"],
};

export default nextConfig;
