'use client';

import { useState, useTransition } from 'react';

import type { ProgressErrorCode } from '@bingetrail/shared';

import type { ProgressActionResult } from '@/lib/progress/actions';

/**
 * Runs a progress Server Action in a transition. `optimistic` applies the
 * expected state at once (useOptimistic setter); when the transition ends React
 * drops it, so a failure falls back to the server state by itself.
 */
export function useProgressAction() {
  const [error, setError] = useState<ProgressErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ProgressActionResult>, optimistic?: () => void) => {
    setError(null);
    startTransition(async () => {
      optimistic?.();
      const result = await action().catch((): ProgressActionResult => ({
        ok: false,
        error: 'unexpected',
      }));
      if (!result.ok) setError(result.error);
    });
  };

  return { run, error, pending };
}
