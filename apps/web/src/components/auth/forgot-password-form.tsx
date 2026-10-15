'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
  type ValidationCode,
} from '@bingetrail/shared';

import { FormAlert } from '@/components/form-alert';
import { FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import { Link } from '@/i18n/navigation';
import { forgotPasswordAction } from '@/lib/auth/actions';

import { useActionSubmit } from './use-action-submit';

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgot');
  const tv = useTranslations('validation');
  const te = useTranslations('errors');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });
  const { submit, error, pending } = useActionSubmit((values: ForgotPasswordInput) =>
    forgotPasswordAction(values),
  );

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      <p className="text-ink-muted text-sm">{t('description')}</p>
      {error && <FormAlert>{te(error)}</FormAlert>}
      <FormField
        label={t('email')}
        type="email"
        autoComplete="email"
        error={errors.email?.message ? tv(errors.email.message as ValidationCode) : undefined}
        {...register('email')}
      />
      <SubmitButton pending={pending} pendingLabel={t('submitting')}>
        {t('submit')}
      </SubmitButton>
      <Link href="/login" className="text-brand-500 text-sm underline-offset-4 hover:underline">
        {t('backToLogin')}
      </Link>
    </form>
  );
}
