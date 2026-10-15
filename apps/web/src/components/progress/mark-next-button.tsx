'use client';

import { useTranslations } from 'next-intl';

import { FormAlert } from '@/components/form-alert';
import { useHydrated } from '@/components/use-hydrated';
import { markEpisodesAction } from '@/lib/progress/actions';

import { useProgressAction } from './use-progress-action';

/** "Watched" on a Continue Watching card; the server then shows the following episode. */
export function MarkNextButton({ episodeId, label }: { episodeId: number; label: string }) {
  const t = useTranslations('continueWatching');
  const tp = useTranslations('progress');
  const hydrated = useHydrated();
  const { run, error, pending } = useProgressAction();

  return (
    <div className="flex flex-col gap-2">
      {error && <FormAlert>{tp(`errors.${error}`)}</FormAlert>}
      <div>
        <button
          type="button"
          aria-label={label}
          disabled={!hydrated || pending}
          onClick={() => run(() => markEpisodesAction({ episodeIds: [episodeId] }))}
          className="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500 rounded-lg px-3 py-1.5 text-sm font-semibold text-white outline-none focus-visible:ring-2 disabled:opacity-60"
        >
          {pending ? tp('saving') : t('markNext')}
        </button>
      </div>
    </div>
  );
}
