'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { signInSchema, type AuthErrorCode, type ValidationCode } from '@bingetrail/shared';

import { FormAlert } from '@/components/form-alert';
import { FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import { Link } from '@/i18n/navigation';
import { signInAction } from '@/lib/auth/actions';

import { useActionSubmit } from './use-action-submit';

export function LoginForm({ next, initialError }: { next?: string; initialError?: AuthErrorCode }) {
  const t = useTranslations('auth.login');
  const tv = useTranslations('validation');
  const te = useTranslations('errors');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const { submit, error, pending } = useActionSubmit(
    (values: { email: string; password: string }) => signInAction(values, next),
  );
  const fieldError = (code?: string) => (code ? tv(code as ValidationCode) : undefined);
  const shownError = error ?? initialError;

  return (
    <form method="post" noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      {shownError && <FormAlert>{te(shownError)}</FormAlert>}
      <FormField
        label={t('email')}
        type="email"
        autoComplete="email"
        error={fieldError(errors.email?.message)}
        {...register('email')}
      />
      <FormField
        label={t('password')}
        type="password"
        autoComplete="current-password"
        error={fieldError(errors.password?.message)}
        {...register('password')}
      />
      <SubmitButton pending={pending} pendingLabel={t('submitting')}>
        {t('submit')}
      </SubmitButton>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/forgot-password" className="text-brand-500 underline-offset-4 hover:underline">
          {t('forgot')}
        </Link>
        <span>
          {t('noAccount')}{' '}
          <Link href="/signup" className="text-brand-500 underline-offset-4 hover:underline">
            {t('signUpLink')}
          </Link>
        </span>
      </div>
    </form>
  );
}
