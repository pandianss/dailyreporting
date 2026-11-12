import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT === "export"
    ? { output: "export", images: { unoptimized: true } }
    : {}),
};

export default nextConfig;
