'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { FormAlert } from '@/components/form-alert';
import { useWatchlistAction } from '@/components/watchlist/use-watchlist-action';
import { useHydrated } from '@/components/use-hydrated';
import { updateWatchlistStatusAction } from '@/lib/watchlist/actions';

/** Offers (never forces) "completed" once every aired episode is watched. */
export function CompletionPrompt({ itemId }: { itemId: string }) {
  const t = useTranslations('progress');
  const tw = useTranslations('watchlist');
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState(false);
  const { run, error, pending } = useWatchlistAction();

  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label={t('completeYes')}
      data-testid="completion-prompt"
      className="flex flex-col gap-3 rounded-lg border border-emerald-500 bg-emerald-500/10 p-4"
    >
      {error && <FormAlert>{tw(`errors.${error}`)}</FormAlert>}
      <p>{t('completeSuggestion')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!hydrated || pending}
          onClick={() => run(() => updateWatchlistStatusAction({ itemId, status: 'completed' }))}
          className="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500 rounded-lg px-3 py-1.5 text-sm font-semibold text-white outline-none focus-visible:ring-2 disabled:opacity-60"
        >
          {pending ? t('saving') : t('completeYes')}
        </button>
        <button
          type="button"
          disabled={!hydrated || pending}
          onClick={() => setDismissed(true)}
          className="bg-surface-muted focus-visible:ring-brand-500 rounded-lg px-3 py-1.5 text-sm outline-none focus-visible:ring-2 disabled:opacity-60"
        >
          {t('completeDismiss')}
        </button>
      </div>
    </div>
  );
}
