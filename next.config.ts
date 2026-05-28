import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow external Farcaster pfp images from any hostname.
    // Using remotePatterns with a broad match since Farcaster pfps come from
    // many different CDNs (imagedelivery.net, res.cloudinary.com, i.imgur.com, etc.)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
