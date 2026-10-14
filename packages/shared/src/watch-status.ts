import { z } from 'zod';

/** Watch states a title can be in. Mirrors the `watch_status` Postgres enum (Faz 1). */
export const WATCH_STATUSES = ['planned', 'watching', 'completed', 'paused', 'dropped'] as const;

export const watchStatusSchema = z.enum(WATCH_STATUSES);

export type WatchStatus = z.infer<typeof watchStatusSchema>;
