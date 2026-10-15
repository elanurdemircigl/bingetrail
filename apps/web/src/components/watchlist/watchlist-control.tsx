'use client';

import { useTranslations } from 'next-intl';
import { useOptimistic, useState } from 'react';

import type { WatchStatus } from '@bingetrail/shared';

import { FormAlert } from '@/components/form-alert';
import { useHydrated } from '@/components/use-hydrated';
import { addToWatchlistAction, updateWatchlistStatusAction } from '@/lib/watchlist/actions';

import { DetailsForm } from './details-form';
import { RemoveButton } from './remove-button';
import { StatusSelect } from './status-select';
import { useWatchlistAction } from './use-watchlist-action';

export type WatchlistEntry = {
  id: string;
  status: WatchStatus;
  rating: number | null;
  notes: string | null;
};

/**
 * List controls on the title page. Status changes and adding are optimistic;
 * the server re-renders the page afterwards (revalidatePath), and a failed
 * action falls back to the server state with an error message.
 */
export function WatchlistControl({
  titleId,
  title,
  entry,
}: {
  titleId: number;
  title: string;
  entry: WatchlistEntry | null;
}) {
  const t = useTranslations('watchlist');
  const hydrated = useHydrated();
  const [newStatus, setNewStatus] = useState<WatchStatus>('planned');
  const [status, setOptimisticStatus] = useOptimistic(entry?.status ?? null);
  const add = useWatchlistAction();
  const change = useWatchlistAction();
  const error = add.error ?? change.error;

  return (
    <section
      aria-labelledby="watchlist-heading"
      data-testid="watchlist-control"
      className="bg-surface-raised rounded-card flex flex-col gap-4 p-4"
    >
      <h2 id="watchlist-heading" className="text-xl font-semibold">
        {t('heading')}
      </h2>
      {error && <FormAlert>{t(`errors.${error}`)}</FormAlert>}

      {!entry || !status ? (
        <form
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            add.run(() => addToWatchlistAction({ titleId, status: newStatus }), {
              optimistic: () => setOptimisticStatus(newStatus),
            });
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-ink-muted text-sm">
            {status ? t(`status.${status}`) : t('notInList')}
          </p>
          <StatusSelect value={newStatus} onChange={setNewStatus} disabled={add.pending} />
          <div>
            <button
              type="submit"
              disabled={add.pending || !hydrated}
              className="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500 rounded-lg px-4 py-2 font-semibold text-white outline-none focus-visible:ring-2 disabled:opacity-60"
            >
              {add.pending ? t('adding') : t('add')}
            </button>
          </div>
        </form>
      ) : (
        <>
          <StatusSelect
            value={status}
            onChange={(next) =>
              change.run(() => updateWatchlistStatusAction({ itemId: entry.id, status: next }), {
                optimistic: () => setOptimisticStatus(next),
              })
            }
          />
          <DetailsForm key={entry.id} itemId={entry.id} rating={entry.rating} notes={entry.notes} />
          <RemoveButton itemId={entry.id} title={title} />
        </>
      )}
    </section>
  );
}
