'use client';

import type { ReactNode } from 'react';

import { useHydrated } from './use-hydrated';

/**
 * Disabled until hydration: a click before React attaches the form handler
 * would otherwise be lost (or, without method="post", turn into a native GET
 * that puts field values in the URL).
 */
export function SubmitButton({
  pending,
  children,
  pendingLabel,
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel: string;
}) {
  const hydrated = useHydrated();
  const disabled = pending || !hydrated;

  return (
    <button
      type="submit"
      disabled={disabled}
      aria-disabled={disabled}
      className="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500 rounded-lg px-4 py-2 font-semibold text-white transition outline-none focus-visible:ring-2 disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
