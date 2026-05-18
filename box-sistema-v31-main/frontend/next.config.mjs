/** @type {import('next').NextConfig} */
const API_TARGET = process.env.API_TARGET || "http://localhost:3001"

const staticExport =
  process.env.STATIC_EXPORT === "1" || process.env.STATIC_EXPORT === "true"

const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

if (staticExport) {
  nextConfig.output = "export"
  nextConfig.distDir = process.env.NEXT_DIST_DIR || ".next"
} else {
  nextConfig.rewrites = async () => [
    {
      source: "/api/:path*",
      destination: `${API_TARGET}/api/:path*`,
    },
  ]
}

export default nextConfig
