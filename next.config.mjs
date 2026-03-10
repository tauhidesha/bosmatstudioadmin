/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Enable code splitting and tree shaking (Requirement 17.6)
  experimental: {
    optimizePackageImports: ['firebase', 'react-icons'],
  },
};

export default nextConfig;
