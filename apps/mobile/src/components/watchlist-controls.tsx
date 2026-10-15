import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { z } from 'zod';

import { WatchlistError, type WatchlistItemDTO } from '@bingetrail/api-client';
import {
  NOTES_MAX_LENGTH,
  notesSchema,
  RATING_MAX,
  RATING_MIN,
  ratingSchema,
  WATCH_STATUSES,
  type ValidationCode,
  type WatchStatus,
} from '@bingetrail/shared';

import {
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useUpdateDetails,
  useUpdateStatus,
} from '@/lib/queries';

import { Alert, Button, Chip, Heading, Muted, TextField } from './ui';

const errorOf = (error: unknown) => (error instanceof WatchlistError ? error.code : 'unexpected');

export function StatusChips({
  value,
  onChange,
  disabled,
}: {
  value: WatchStatus;
  onChange: (status: WatchStatus) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('watchlist.statusLabel')}
      className="flex-row flex-wrap gap-2"
    >
      {WATCH_STATUSES.map((status) => (
        <Chip
          key={status}
          label={t(`watchlist.status.${status}`)}
          selected={status === value}
          disabled={disabled}
          onPress={() => onChange(status)}
        />
      ))}
    </View>
  );
}

const detailsSchema = z.object({ rating: ratingSchema, notes: notesSchema });
const RATINGS = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

function DetailsForm({ item }: { item: WatchlistItemDTO }) {
  const { t } = useTranslation();
  const update = useUpdateDetails();
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(detailsSchema),
    defaultValues: { rating: item.rating, notes: item.notes ?? '' },
  });
  const noteLength = (useWatch({ control, name: 'notes' }) ?? '').length;
  const notesError = formState.errors.notes?.message;

  return (
    <View className="gap-3">
      {update.isError && <Alert>{t(`watchlist.errors.${errorOf(update.error)}`)}</Alert>}
      {update.isSuccess && <Alert tone="success">{t('watchlist.saved')}</Alert>}
      <Text className="text-sm font-medium text-ink">{t('watchlist.rating')}</Text>
      <Controller
        control={control}
        name="rating"
        render={({ field }) => (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('watchlist.rating')}
            className="flex-row flex-wrap gap-2"
          >
            <Chip
              label={t('watchlist.ratingNone')}
              selected={field.value === null}
              onPress={() => field.onChange(null)}
            />
            {RATINGS.map((rating) => (
              <Chip
                key={rating}
                label={String(rating)}
                selected={field.value === rating}
                onPress={() => field.onChange(rating)}
              />
            ))}
          </View>
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <TextField
            label={t('watchlist.notes')}
            hint={`${t('watchlist.notesHint')} ${t('watchlist.notesCount', { count: noteLength, max: NOTES_MAX_LENGTH })}`}
            value={field.value ?? ''}
            onChangeText={field.onChange}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            error={notesError ? t(`validation.${notesError as ValidationCode}`) : undefined}
          />
        )}
      />
      <Button
        label={t('watchlist.save')}
        pendingLabel={t('watchlist.saving')}
        pending={update.isPending}
        onPress={handleSubmit((values) => update.mutate({ itemId: item.id, ...values }))}
      />
    </View>
  );
}

function RemoveButton({ item, title }: { item: WatchlistItemDTO; title: string }) {
  const { t } = useTranslation();
  const remove = useRemoveFromWatchlist();
  const [confirming, setConfirming] = useState(false);

  if (!confirming)
    return (
      <Button tone="secondary" label={t('watchlist.remove')} onPress={() => setConfirming(true)} />
    );
  return (
    <View className="gap-3 rounded-lg border border-brand-600 p-3">
      {remove.isError && <Alert>{t(`watchlist.errors.${errorOf(remove.error)}`)}</Alert>}
      <Text className="text-ink">{t('watchlist.removeConfirm', { title })}</Text>
      <Button
        label={t('watchlist.removeYes')}
        pendingLabel={t('watchlist.removing')}
        pending={remove.isPending}
        onPress={() => remove.mutate(item.id)}
      />
      <Button
        tone="secondary"
        label={t('watchlist.removeCancel')}
        onPress={() => setConfirming(false)}
      />
    </View>
  );
}

/** List controls on the title screen (same rules as the web WatchlistControl). */
export function WatchlistControls({
  titleId,
  title,
  item,
}: {
  titleId: number;
  title: string;
  item: WatchlistItemDTO | null;
}) {
  const { t } = useTranslation();
  const add = useAddToWatchlist();
  const updateStatus = useUpdateStatus(titleId);
  const [newStatus, setNewStatus] = useState<WatchStatus>('planned');
  const error = add.error ?? updateStatus.error;

  return (
    <View testID="watchlist-control" className="gap-4 rounded-card bg-surface-raised p-4">
      <Heading>{t('watchlist.heading')}</Heading>
      {error && <Alert>{t(`watchlist.errors.${errorOf(error)}`)}</Alert>}
      {item ? (
        <>
          <StatusChips
            value={item.status}
            onChange={(status) => updateStatus.mutate({ itemId: item.id, status })}
          />
          <DetailsForm key={item.id} item={item} />
          <RemoveButton item={item} title={title} />
        </>
      ) : (
        <>
          <Muted>{t('watchlist.notInList')}</Muted>
          <StatusChips value={newStatus} onChange={setNewStatus} disabled={add.isPending} />
          <Button
            label={t('watchlist.add')}
            pendingLabel={t('watchlist.adding')}
            pending={add.isPending}
            onPress={() => add.mutate({ titleId, status: newStatus })}
          />
        </>
      )}
    </View>
  );
}
