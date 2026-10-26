import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les créations et les photos envoyées par les clients sont stockées sur disque
  // et servies par /api/files, jamais depuis /public.
  serverExternalPackages: ["@prisma/client", "sharp"],
  experimental: {
    // Les documents de l'éditeur sont des JSON volumineux.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
