import type { NextConfig } from "next";
import { loadEnvFile } from "node:process";
import path from "node:path";

loadEnvFile(path.resolve(process.cwd(), "../.env"));

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

export default nextConfig;
