import { z } from 'zod';

import { watchStatusSchema, type WatchStatus } from './watch-status';

export const RATING_MIN = 1;
export const RATING_MAX = 10;
export const NOTES_MAX_LENGTH = 5000;

export type StatusDates = {
  status: WatchStatus;
  startedAt: string | null;
  completedAt: string | null;
};

/**
 * Derives the timestamps for a status change. Mirrors the database constraints
 * (watchlist_consistency migration):
 * - watching/completed always have a start date (kept if already set);
 * - only completed has a finish date (re-watching clears it);
 * - back to planned means "not started": both dates are cleared;
 * - paused/dropped keep whatever start date there was.
 */
export function applyStatusChange(
  current: Omit<StatusDates, 'status'> | null,
  next: WatchStatus,
  nowIso: string,
): StatusDates {
  const startedAt = current?.startedAt ?? null;
  switch (next) {
    case 'planned':
      return { status: next, startedAt: null, completedAt: null };
    case 'watching':
      return { status: next, startedAt: startedAt ?? nowIso, completedAt: null };
    case 'completed':
      return { status: next, startedAt: startedAt ?? nowIso, completedAt: nowIso };
    case 'paused':
    case 'dropped':
      return { status: next, startedAt, completedAt: null };
  }
}

export const ratingSchema = z
  .number({ error: 'ratingRange' })
  .int({ error: 'ratingRange' })
  .min(RATING_MIN, { error: 'ratingRange' })
  .max(RATING_MAX, { error: 'ratingRange' })
  .nullable();

/** Notes are plain text; blank notes are stored as NULL. */
export const notesSchema = z
  .string()
  .max(NOTES_MAX_LENGTH, { error: 'notesTooLong' })
  .transform((value) => (value.trim() === '' ? null : value))
  .nullable();

const itemIdSchema = z.uuid();
const titleIdSchema = z.number().int().positive();

export const addToWatchlistSchema = z.object({
  titleId: titleIdSchema,
  status: watchStatusSchema.default('planned'),
});

export const updateWatchlistStatusSchema = z.object({
  itemId: itemIdSchema,
  status: watchStatusSchema,
});

export const updateWatchlistDetailsSchema = z.object({
  itemId: itemIdSchema,
  rating: ratingSchema,
  notes: notesSchema,
});

export const removeFromWatchlistSchema = z.object({ itemId: itemIdSchema });

export const WATCHLIST_SORTS = ['recent', 'added', 'title', 'rating'] as const;
export type WatchlistSort = (typeof WATCHLIST_SORTS)[number];

export type WatchlistFilters = { status: WatchStatus | null; sort: WatchlistSort };

/** List screen filters, parsed from untrusted URL query params. */
export function parseWatchlistFilters(raw: { status?: unknown; sort?: unknown }): WatchlistFilters {
  const status = watchStatusSchema.safeParse(raw.status);
  const sort = (WATCHLIST_SORTS as readonly unknown[]).includes(raw.sort)
    ? (raw.sort as WatchlistSort)
    : 'recent';
  return { status: status.success ? status.data : null, sort };
}

export const WATCHLIST_ERROR_CODES = ['already_exists', 'not_found', 'unexpected'] as const;
export type WatchlistErrorCode = (typeof WATCHLIST_ERROR_CODES)[number];

export type AddToWatchlistInput = z.input<typeof addToWatchlistSchema>;
export type UpdateWatchlistDetailsInput = z.input<typeof updateWatchlistDetailsSchema>;
