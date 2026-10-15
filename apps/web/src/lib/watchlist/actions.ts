'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import {
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlistDetails,
  updateWatchlistStatus,
  WatchlistError,
} from '@bingetrail/api-client';
import {
  addToWatchlistSchema,
  removeFromWatchlistSchema,
  updateWatchlistDetailsSchema,
  updateWatchlistStatusSchema,
  type WatchlistErrorCode,
} from '@bingetrail/shared';

import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

// Server Actions are public endpoints: every input is re-validated here. Rows
// are written with the user's own session, so RLS decides what may change;
// notes and ratings are never logged.

export type WatchlistActionResult = { ok: true } | { ok: false; error: WatchlistErrorCode };

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function run<T>(
  parsed: { success: true; data: T } | { success: false },
  operation: (supabase: Supabase, input: T) => Promise<unknown>,
): Promise<WatchlistActionResult> {
  if (!parsed.success) return { ok: false, error: 'unexpected' };
  if (!(await getSessionUser())) redirect(`/${await getLocale()}/login`);

  try {
    await operation(await createClient(), parsed.data);
  } catch (error) {
    return { ok: false, error: error instanceof WatchlistError ? error.code : 'unexpected' };
  }
  // List pages render per request; this refreshes the client router's copy.
  revalidatePath('/', 'layout');
  return { ok: true };
}

const now = () => new Date().toISOString();

export async function addToWatchlistAction(input: unknown): Promise<WatchlistActionResult> {
  return run(addToWatchlistSchema.safeParse(input), (supabase, data) =>
    addToWatchlist(supabase, data, now()),
  );
}

export async function updateWatchlistStatusAction(input: unknown): Promise<WatchlistActionResult> {
  return run(updateWatchlistStatusSchema.safeParse(input), (supabase, data) =>
    updateWatchlistStatus(supabase, data.itemId, data.status, now()),
  );
}

export async function updateWatchlistDetailsAction(input: unknown): Promise<WatchlistActionResult> {
  return run(updateWatchlistDetailsSchema.safeParse(input), (supabase, data) =>
    updateWatchlistDetails(
      supabase,
      data.itemId,
      { rating: data.rating, notes: data.notes },
      now(),
    ),
  );
}

export async function removeFromWatchlistAction(input: unknown): Promise<WatchlistActionResult> {
  return run(removeFromWatchlistSchema.safeParse(input), (supabase, data) =>
    removeFromWatchlist(supabase, data.itemId),
  );
}
