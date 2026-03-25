import path from "path";
import { fileURLToPath } from "url";

// 工作區開在 repo 根目錄時，Turbopack 可能把解析根設成上一層，導致
// globals.css 的 @import "tailwindcss" 在 D:\dcim-system 找 node_modules 而失敗。
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
