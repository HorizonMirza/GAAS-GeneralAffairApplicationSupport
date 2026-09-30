import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pins Turbopack's project root to this folder explicitly. Without this, Turbopack walks up
  // parent directories looking for a workspace root and can pick the wrong one if it finds an
  // unrelated lockfile further up the tree (e.g. one sitting in a user's home directory) -
  // Turbopack then resolves node_modules from that wrong root instead of this project's own,
  // which surfaces as "Cannot find module" errors for packages that are actually installed here.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
