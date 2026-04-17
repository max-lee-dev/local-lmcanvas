import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // silence the multi-lockfile warning by anchoring to this app's folder
    root: ".",
  },
};

export default nextConfig;
