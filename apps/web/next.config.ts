import type { NextConfig } from 'next';

// Baseline security headers. A full CSP is added once Supabase origins are known (Faz 2/10).
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@bingetrail/i18n'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'image.tmdb.org', pathname: '/t/p/**' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
