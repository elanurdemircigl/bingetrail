'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import {
  NOTES_MAX_LENGTH,
  notesSchema,
  RATING_MAX,
  RATING_MIN,
  ratingSchema,
  type ValidationCode,
} from '@bingetrail/shared';

import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { updateWatchlistDetailsAction } from '@/lib/watchlist/actions';

import { useWatchlistAction } from './use-watchlist-action';

const detailsSchema = z.object({ rating: ratingSchema, notes: notesSchema });
const RATINGS = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

/** Rating (1–10 or none) and personal notes; notes are plain text, never HTML. */
export function DetailsForm({
  itemId,
  rating,
  notes,
}: {
  itemId: string;
  rating: number | null;
  notes: string | null;
}) {
  const t = useTranslations('watchlist');
  const tv = useTranslations('validation');
  const ratingId = useId();
  const notesId = useId();
  const [saved, setSaved] = useState(false);
  const { run, error, pending } = useWatchlistAction();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(detailsSchema),
    defaultValues: { rating, notes: notes ?? '' },
  });
  const noteLength = (useWatch({ control, name: 'notes' }) ?? '').length;
  const notesError = errors.notes?.message;
  const ratingError = errors.rating?.message;

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit((values) => {
        setSaved(false);
        run(() => updateWatchlistDetailsAction({ itemId, ...values }), {
          onSuccess: () => setSaved(true),
        });
      })}
      className="flex flex-col gap-4"
    >
      {error && <FormAlert>{t(`errors.${error}`)}</FormAlert>}
      {saved && !pending && <FormAlert tone="success">{t('saved')}</FormAlert>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ratingId} className="text-sm font-medium">
          {t('rating')}
        </label>
        <select
          id={ratingId}
          aria-invalid={ratingError ? true : undefined}
          className="bg-surface border-surface-muted focus-visible:ring-brand-500 max-w-xs rounded-lg border px-3 py-2 outline-none focus-visible:ring-2"
          {...register('rating', {
            setValueAs: (value: unknown) =>
              value === '' || value === null || value === undefined ? null : Number(value),
          })}
        >
          <option value="">{t('ratingNone')}</option>
          {RATINGS.map((value) => (
            <option key={value} value={value}>
              {t('ratingValue', { rating: value })}
            </option>
          ))}
        </select>
        {ratingError && (
          <p className="text-brand-500 text-sm">{tv(ratingError as ValidationCode)}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={notesId} className="text-sm font-medium">
          {t('notes')}
        </label>
        <textarea
          id={notesId}
          rows={5}
          aria-invalid={notesError ? true : undefined}
          aria-describedby={`${notesId}-hint ${notesId}-count${notesError ? ` ${notesId}-error` : ''}`}
          className="bg-surface border-surface-muted text-ink focus-visible:ring-brand-500 aria-[invalid=true]:border-brand-500 rounded-lg border px-3 py-2 outline-none focus-visible:ring-2"
          {...register('notes')}
        />
        <div className="text-ink-muted flex justify-between gap-2 text-xs">
          <p id={`${notesId}-hint`}>{t('notesHint')}</p>
          <p
            id={`${notesId}-count`}
            className={noteLength > NOTES_MAX_LENGTH ? 'text-brand-500 font-semibold' : undefined}
          >
            {t('notesCount', { count: noteLength, max: NOTES_MAX_LENGTH })}
          </p>
        </div>
        {notesError && (
          <p id={`${notesId}-error`} className="text-brand-500 text-sm">
            {tv(notesError as ValidationCode)}
          </p>
        )}
      </div>

      <div>
        <SubmitButton pending={pending} pendingLabel={t('saving')}>
          {t('save')}
        </SubmitButton>
      </div>
    </form>
  );
}
