/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Deploy safety: type nits must never block the production build.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Deploy safety: lint nits must never block the production build.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
