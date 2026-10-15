import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Baseline security headers. A full CSP is added in Faz 10, once every origin
// (Supabase, TMDB images, hosting) is final.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Stop `next dev` from writing an AGENTS.md into the repository.
  agentRules: false,
  // Dev mode logs Server Action arguments by default — that would print
  // plaintext passwords from the auth forms to the terminal.
  logging: { serverFunctions: false },
  transpilePackages: [
    '@bingetrail/api-client',
    '@bingetrail/db-types',
    '@bingetrail/i18n',
    '@bingetrail/shared',
  ],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'image.tmdb.org', pathname: '/t/p/**' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
