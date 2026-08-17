import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.0.8"],
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
