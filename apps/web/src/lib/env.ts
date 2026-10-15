/**
 * Public Supabase settings. Only the URL and the PUBLISHABLE key may reach the
 * browser (enforced by tooling/security/public-env-check.mjs). Read lazily so
 * unit tests and static builds do not need them.
 */
export function getSupabaseEnv(): { url: string; publishableKey: string } {
  // Referenced literally so Next.js can inline them at build time.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see apps/web/.env.example).',
    );
  }
  return { url, publishableKey };
}
