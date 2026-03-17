import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    optimizePackageImports: ['firebase', 'react-icons'],
    // Next.js 14: server components external packages (tidak di-bundle oleh webpack)
    serverComponentsExternalPackages: [
      'firebase-admin',
      '@langchain/google-genai',
      '@langchain/core',
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Tambahkan alias agar tools JS dari monorepo parent bisa di-resolve
      config.resolve.alias = {
        ...config.resolve.alias,
        '@monorepo/tools': path.join(MONOREPO_ROOT, 'src', 'ai', 'tools'),
        '@monorepo/data': path.join(MONOREPO_ROOT, 'src', 'data'),
      };
    }
    return config;
  },
};

export default nextConfig;
