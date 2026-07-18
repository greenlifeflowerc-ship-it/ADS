import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Media comes from many sources: provider outputs, Cloudinary, third-party
    // ad previews. Allow any HTTPS host (assets are still access-controlled at
    // the source). Tighten to specific hosts if desired.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    // Product/identity images are uploaded through Server Actions (FormData).
    // The default 1MB body cap rejects most photos before our own 15MB check
    // runs, surfacing as "Upload failed". Raise it to match assertImageFile.
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
