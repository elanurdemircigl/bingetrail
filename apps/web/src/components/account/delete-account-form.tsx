'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { deleteAccountFormSchema, type ValidationCode } from '@bingetrail/shared';

import { FormAlert } from '@/components/form-alert';
import { FormField } from '@/components/form-field';
import { useHydrated } from '@/components/use-hydrated';
import { Link } from '@/i18n/navigation';
import { deleteAccountAction, type DeleteAccountErrorCode } from '@/lib/account/actions';

/** Final step of account deletion: password re-authentication plus an explicit acknowledgement. */
export function DeleteAccountForm() {
  const t = useTranslations('account.delete');
  const tv = useTranslations('validation');
  const confirmId = useId();
  const hydrated = useHydrated();
  const [error, setError] = useState<DeleteAccountErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(deleteAccountFormSchema),
    defaultValues: { password: '', confirm: false as unknown as true },
  });
  const fieldError = (code?: string) => (code ? tv(code as ValidationCode) : undefined);
  const confirmError = fieldError(errors.confirm?.message);

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit((values) => {
        setError(null);
        startTransition(async () => {
          // Success redirects on the server; only failures come back.
          const result = await deleteAccountAction(values);
          if (result && !result.ok) setError(result.error);
        });
      })}
      className="flex flex-col gap-4"
    >
      {error && <FormAlert>{t(`errors.${error}`)}</FormAlert>}
      <FormField
        label={t('password')}
        type="password"
        autoComplete="current-password"
        hint={t('passwordHint')}
        error={fieldError(errors.password?.message)}
        {...register('password')}
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <input
            id={confirmId}
            type="checkbox"
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={confirmError ? `${confirmId}-error` : undefined}
            className="accent-brand-600 mt-1 h-4 w-4"
            {...register('confirm')}
          />
          <label htmlFor={confirmId} className="text-sm">
            {t('confirm')}
          </label>
        </div>
        {confirmError && (
          <p id={`${confirmId}-error`} className="text-brand-500 text-sm">
            {confirmError}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending || !hydrated}
          aria-disabled={pending || !hydrated}
          className="focus-visible:ring-brand-500 rounded-lg bg-red-700 px-4 py-2 font-semibold text-white outline-none hover:bg-red-800 focus-visible:ring-2 disabled:opacity-60"
        >
          {pending ? t('submitting') : t('submit')}
        </button>
        <Link href="/profile" className="text-brand-500 underline-offset-4 hover:underline">
          {t('cancel')}
        </Link>
      </div>
    </form>
  );
}
