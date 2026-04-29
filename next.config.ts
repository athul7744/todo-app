import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB — covers PowerSync WASM files
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSerwist(nextConfig);
