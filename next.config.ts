import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir: process.env.FLAT_BUILD_DIR || '.next',
  serverExternalPackages: ['@libsql/client', 'pg'],
  poweredByHeader: false,
  experimental: { optimizePackageImports: ['wagmi', 'wagmi/connectors', 'lucide-react', '@react-three/drei'] },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' }
    ] }];
  }
};
export default config;
