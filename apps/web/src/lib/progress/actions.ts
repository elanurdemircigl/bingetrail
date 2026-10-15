'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { markEpisodesWatched, ProgressError, unmarkEpisodes } from '@bingetrail/api-client';
import { episodeIdsSchema, type ProgressErrorCode } from '@bingetrail/shared';

import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

// Server Actions are public endpoints: input is re-validated here, and the
// RPCs run with the user's own session (SECURITY INVOKER + RLS). Any number
// of episodes (≤ 2000) is one database call.

export type ProgressActionResult = { ok: true } | { ok: false; error: ProgressErrorCode };

async function run(
  input: unknown,
  operation: typeof markEpisodesWatched,
): Promise<ProgressActionResult> {
  const parsed = episodeIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unexpected' };
  if (!(await getSessionUser())) redirect(`/${await getLocale()}/login`);

  try {
    await operation(await createClient(), parsed.data.episodeIds);
  } catch (error) {
    return { ok: false, error: error instanceof ProgressError ? error.code : 'unexpected' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function markEpisodesAction(input: unknown): Promise<ProgressActionResult> {
  return run(input, markEpisodesWatched);
}

export async function unmarkEpisodesAction(input: unknown): Promise<ProgressActionResult> {
  return run(input, unmarkEpisodes);
}
