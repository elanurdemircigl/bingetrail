'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { FormAlert } from '@/components/form-alert';
import { useHydrated } from '@/components/use-hydrated';
import { removeFromWatchlistAction } from '@/lib/watchlist/actions';

import { useWatchlistAction } from './use-watchlist-action';

/** Two-step removal: the first click only asks for confirmation. */
export function RemoveButton({
  itemId,
  title,
  onRemoved,
}: {
  itemId: string;
  title: string;
  onRemoved?: () => void;
}) {
  const t = useTranslations('watchlist');
  const hydrated = useHydrated();
  const [confirming, setConfirming] = useState(false);
  const { run, error, pending } = useWatchlistAction();

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          disabled={!hydrated}
          onClick={() => setConfirming(true)}
          className="text-brand-500 focus-visible:ring-brand-500 rounded-lg text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 disabled:opacity-60"
        >
          {t('remove')}
        </button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t('remove')}
      className="border-brand-600 flex flex-col gap-3 rounded-lg border p-3"
    >
      {error && <FormAlert>{t(`errors.${error}`)}</FormAlert>}
      <p className="text-sm">{t('removeConfirm', { title })}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => removeFromWatchlistAction({ itemId }), {
              onSuccess: () => {
                setConfirming(false);
                onRemoved?.();
              },
            })
          }
          className="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500 rounded-lg px-3 py-1.5 text-sm font-semibold text-white outline-none focus-visible:ring-2 disabled:opacity-60"
        >
          {pending ? t('removing') : t('removeYes')}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="bg-surface-muted focus-visible:ring-brand-500 rounded-lg px-3 py-1.5 text-sm outline-none focus-visible:ring-2 disabled:opacity-60"
        >
          {t('removeCancel')}
        </button>
      </div>
    </div>
  );
}
