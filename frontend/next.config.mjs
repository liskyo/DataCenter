import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack logic
  experimental: {
    // Some versions of Next use this for Turbopack root
  },
  // Ensure we don't have conflicting options
};

export default nextConfig;
