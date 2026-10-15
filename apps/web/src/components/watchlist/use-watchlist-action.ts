'use client';

import { useState, useTransition } from 'react';

import type { WatchlistErrorCode } from '@bingetrail/shared';

import type { WatchlistActionResult } from '@/lib/watchlist/actions';

/**
 * Runs a watchlist Server Action inside a transition. `optimistic` applies the
 * expected outcome immediately (useOptimistic setter); React drops it when the
 * transition ends, so a failed action reverts to the server state on its own.
 */
export function useWatchlistAction() {
  const [error, setError] = useState<WatchlistErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (
    action: () => Promise<WatchlistActionResult>,
    { optimistic, onSuccess }: { optimistic?: () => void; onSuccess?: () => void } = {},
  ) => {
    setError(null);
    startTransition(async () => {
      optimistic?.();
      const result = await action().catch((): WatchlistActionResult => ({
        ok: false,
        error: 'unexpected',
      }));
      if (result.ok) onSuccess?.();
      else setError(result.error);
    });
  };

  return { run, error, pending, clearError: () => setError(null) };
}
