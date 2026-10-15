'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { WATCH_STATUSES, type WatchStatus } from '@bingetrail/shared';

import { useHydrated } from '@/components/use-hydrated';

/** Accessible status picker; disabled until hydration so no change is lost. */
export function StatusSelect({
  value,
  onChange,
  disabled = false,
  label,
}: {
  value: WatchStatus;
  onChange: (status: WatchStatus) => void;
  disabled?: boolean;
  label?: string;
}) {
  const t = useTranslations('watchlist');
  const id = useId();
  const hydrated = useHydrated();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label ?? t('statusLabel')}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled || !hydrated}
        onChange={(event) => onChange(event.target.value as WatchStatus)}
        className="bg-surface border-surface-muted focus-visible:ring-brand-500 max-w-xs rounded-lg border px-3 py-2 outline-none focus-visible:ring-2 disabled:opacity-60"
      >
        {WATCH_STATUSES.map((status) => (
          <option key={status} value={status}>
            {t(`status.${status}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
