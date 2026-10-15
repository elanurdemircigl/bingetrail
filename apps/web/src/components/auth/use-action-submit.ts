'use client';

import { useState, useTransition } from 'react';

import type { AuthErrorCode } from '@bingetrail/shared';

import type { ActionResult } from '@/lib/auth/actions';

/**
 * Runs a Server Action from a form and exposes its error code. Successful
 * actions redirect on the server, so only failures come back here.
 */
export function useActionSubmit<T>(action: (values: T) => Promise<ActionResult | void>) {
  const [error, setError] = useState<AuthErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (values: T) => {
    setError(null);
    startTransition(async () => {
      const result = await action(values);
      if (result && !result.ok) setError(result.error);
    });
  };

  return { submit, error, pending };
}
