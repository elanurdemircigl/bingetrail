'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import {
  resetPasswordSchema,
  type ResetPasswordInput,
  type ValidationCode,
} from '@bingetrail/shared';

import { FormAlert } from '@/components/form-alert';
import { FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import { resetPasswordAction } from '@/lib/auth/actions';

import { useActionSubmit } from './use-action-submit';

export function ResetPasswordForm() {
  const t = useTranslations('auth.reset');
  const ts = useTranslations('auth.signup');
  const tv = useTranslations('validation');
  const te = useTranslations('errors');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const { submit, error, pending } = useActionSubmit((values: ResetPasswordInput) =>
    resetPasswordAction(values),
  );
  const fieldError = (code?: string) => (code ? tv(code as ValidationCode) : undefined);

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      {error && <FormAlert>{te(error)}</FormAlert>}
      <FormField
        label={t('password')}
        type="password"
        autoComplete="new-password"
        hint={ts('passwordHint')}
        error={fieldError(errors.password?.message)}
        {...register('password')}
      />
      <FormField
        label={t('confirmPassword')}
        type="password"
        autoComplete="new-password"
        error={fieldError(errors.confirmPassword?.message)}
        {...register('confirmPassword')}
      />
      <SubmitButton pending={pending} pendingLabel={t('submitting')}>
        {t('submit')}
      </SubmitButton>
    </form>
  );
}
