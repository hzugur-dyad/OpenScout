import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack: proje kökünü bu uygulama klasörü yap (üstteki lockfile yüzünden root yanlış seçilmesin)
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
