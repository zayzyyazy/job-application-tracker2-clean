import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const isTauriDev = process.env.TAURI_DEV === "1";
const internalHost = process.env.TAURI_DEV_HOST || "localhost";

const nextConfig: NextConfig = {
  // Required for packaging a runnable `next start`-style server for the desktop build.
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  images: {
    unoptimized: true,
  },
  // Tauri dev + webview (official pattern); omit when running `next dev` in a normal browser.
  ...(isTauriDev && !isProd
    ? { assetPrefix: `http://${internalHost}:3000` }
    : {}),
};

export default nextConfig;
