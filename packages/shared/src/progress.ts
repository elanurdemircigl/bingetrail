import { z } from 'zod';

import type { WatchStatus } from './watch-status';

/** Per-call limit of the mark/unmark RPCs (mirrors the database check). */
export const MAX_EPISODES_PER_REQUEST = 2000;

export const PROGRESS_ERROR_CODES = [
  'episode_not_aired',
  'episode_not_found',
  'too_many_episodes',
  'unexpected',
] as const;
export type ProgressErrorCode = (typeof PROGRESS_ERROR_CODES)[number];

export const episodeIdsSchema = z.object({
  episodeIds: z.array(z.number().int().positive()).min(1).max(MAX_EPISODES_PER_REQUEST),
});
export type EpisodeIdsInput = z.infer<typeof episodeIdsSchema>;

/** Today's calendar date in UTC (`YYYY-MM-DD`), like `catalog_today()` in the database. */
export const utcToday = (now: Date = new Date()) => now.toISOString().slice(0, 10);

/** An episode counts as aired once its (known) air date is today or earlier. */
export const isAired = (airDate: string | null, today: string) =>
  airDate !== null && airDate <= today;

type EpisodeLike = { id: number; episodeNumber: number; airDate: string | null };

export type Progress = { aired: number; watched: number; percent: number };

/** Watched share of aired episodes; unaired ones never count. */
export function progressOf(
  episodes: readonly EpisodeLike[],
  watched: ReadonlySet<number>,
  today: string,
): Progress {
  const aired = episodes.filter((e) => isAired(e.airDate, today));
  return toProgress(aired.length, aired.filter((e) => watched.has(e.id)).length);
}

export function toProgress(aired: number, watched: number): Progress {
  const capped = Math.min(watched, aired);
  return { aired, watched: capped, percent: aired === 0 ? 0 : Math.floor((capped / aired) * 100) };
}

/** "Mark up to here": every aired episode of the season up to and including `episodeNumber`. */
export function airedIdsUpTo(
  episodes: readonly EpisodeLike[],
  episodeNumber: number,
  today: string,
): number[] {
  return episodes
    .filter((e) => e.episodeNumber <= episodeNumber && isAired(e.airDate, today))
    .map((e) => e.id);
}

/**
 * "Mark as completed?" is offered (never applied automatically) once every
 * aired regular episode is watched and the catalog holds all aired seasons.
 */
export function shouldSuggestCompletion(input: {
  status: WatchStatus | null;
  airedCount: number;
  watchedCount: number;
  catalogComplete: boolean;
}): boolean {
  return (
    input.status !== null &&
    input.status !== 'completed' &&
    input.catalogComplete &&
    input.airedCount > 0 &&
    input.watchedCount >= input.airedCount
  );
}
