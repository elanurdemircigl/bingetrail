'use client';

import { useTranslations } from 'next-intl';
import { useOptimistic } from 'react';

import { airedIdsUpTo, isAired, progressOf } from '@bingetrail/shared';

import { FormAlert } from '@/components/form-alert';
import { useHydrated } from '@/components/use-hydrated';
import { markEpisodesAction, unmarkEpisodesAction } from '@/lib/progress/actions';

import { ProgressBar } from './progress-bar';
import { useProgressAction } from './use-progress-action';

export type EpisodeRow = {
  id: number;
  episodeNumber: number;
  name: string;
  airDate: string | null;
  /** Already formatted on the server (date · runtime). */
  meta: string;
};

type Change = { ids: readonly number[]; watched: boolean };

/**
 * Season episode list with watched toggles, "up to here", and whole-season
 * actions. Every action is a single request; the UI updates optimistically.
 */
export function EpisodeList({
  episodes,
  watchedIds,
  today,
}: {
  episodes: EpisodeRow[];
  watchedIds: number[];
  /** Server's UTC date, so server and client agree on what has aired. */
  today: string;
}) {
  const t = useTranslations('progress');
  const hydrated = useHydrated();
  const { run, error, pending } = useProgressAction();
  const [watched, applyChange] = useOptimistic(
    new Set(watchedIds),
    (current: Set<number>, change: Change) => {
      const next = new Set(current);
      for (const id of change.ids) {
        if (change.watched) next.add(id);
        else next.delete(id);
      }
      return next;
    },
  );

  const mark = (ids: number[]) => {
    const fresh = ids.filter((id) => !watched.has(id));
    if (fresh.length === 0) return;
    run(
      () => markEpisodesAction({ episodeIds: fresh }),
      () => applyChange({ ids: fresh, watched: true }),
    );
  };
  const unmark = (ids: number[]) => {
    const marked = ids.filter((id) => watched.has(id));
    if (marked.length === 0) return;
    run(
      () => unmarkEpisodesAction({ episodeIds: marked }),
      () => applyChange({ ids: marked, watched: false }),
    );
  };

  const progress = progressOf(episodes, watched, today);
  const airedIds = episodes.filter((e) => isAired(e.airDate, today)).map((e) => e.id);
  const disabled = !hydrated || pending;
  const buttonClass =
    'bg-surface-raised hover:bg-surface-muted focus-visible:ring-brand-500 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 disabled:opacity-60';

  return (
    <div className="flex flex-col gap-3">
      {error && <FormAlert>{t(`errors.${error}`)}</FormAlert>}
      {progress.aired > 0 && (
        <ProgressBar
          progress={progress}
          label={t('barLabel')}
          text={t('seasonBar', { watched: progress.watched, aired: progress.aired })}
          testId="season-progress"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || progress.watched === progress.aired}
          onClick={() => mark(airedIds)}
        >
          {t('markSeason')}
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || progress.watched === 0}
          onClick={() => unmark(episodes.map((e) => e.id))}
        >
          {t('unmarkSeason')}
        </button>
        {pending && (
          <span role="status" className="text-ink-muted self-center text-sm">
            {t('saving')}
          </span>
        )}
      </div>

      <ol className="flex flex-col gap-2">
        {episodes.map((episode) => {
          const aired = isAired(episode.airDate, today);
          const isWatched = watched.has(episode.id);
          const checkboxId = `episode-${episode.id}`;
          return (
            <li
              key={episode.id}
              data-testid="episode"
              data-watched={isWatched ? 'true' : 'false'}
              className="bg-surface-raised flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={isWatched}
                  disabled={disabled || !aired}
                  aria-label={t('watchedLabel', { number: episode.episodeNumber })}
                  onChange={(event) =>
                    event.target.checked ? mark([episode.id]) : unmark([episode.id])
                  }
                  className="accent-brand-600 h-5 w-5 shrink-0"
                />
                <label htmlFor={checkboxId} className="min-w-0">
                  <span className="text-ink-muted mr-2 text-sm">{episode.episodeNumber}.</span>
                  <span className="font-medium">{episode.name}</span>
                  <span className="text-ink-muted block text-sm">
                    {episode.meta}
                    {!aired && ` · ${t('notAired')}`}
                  </span>
                </label>
              </div>
              {aired && episode.episodeNumber > 1 && (
                <button
                  type="button"
                  className="text-brand-500 focus-visible:ring-brand-500 rounded text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 disabled:opacity-60"
                  disabled={disabled}
                  aria-label={t('markUpToLabel', { number: episode.episodeNumber })}
                  onClick={() => mark(airedIdsUpTo(episodes, episode.episodeNumber, today))}
                >
                  {t('markUpTo')}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
