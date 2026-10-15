'use client';

import { useTranslations } from 'next-intl';
import { useOptimistic } from 'react';

import type { WatchStatus } from '@bingetrail/shared';

import { FormAlert } from '@/components/form-alert';
import { updateWatchlistStatusAction } from '@/lib/watchlist/actions';

import { RemoveButton } from './remove-button';
import { StatusSelect } from './status-select';
import { useWatchlistAction } from './use-watchlist-action';

/** Quick status change and removal for one row of the list page. */
export function ListItemActions({
  itemId,
  title,
  status,
}: {
  itemId: string;
  title: string;
  status: WatchStatus;
}) {
  const t = useTranslations('watchlist');
  const [shownStatus, setOptimisticStatus] = useOptimistic(status);
  const { run, error } = useWatchlistAction();

  return (
    <div className="flex flex-col gap-3">
      {error && <FormAlert>{t(`errors.${error}`)}</FormAlert>}
      <StatusSelect
        value={shownStatus}
        label={t('statusLabel')}
        onChange={(next) =>
          run(() => updateWatchlistStatusAction({ itemId, status: next }), {
            optimistic: () => setOptimisticStatus(next),
          })
        }
      />
      <RemoveButton itemId={itemId} title={title} />
    </div>
  );
}
