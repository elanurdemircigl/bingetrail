'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { signUpSchema, type SignUpInput, type ValidationCode } from '@bingetrail/shared';

import { FormAlert } from '@/components/form-alert';
import { FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import { Link } from '@/i18n/navigation';
import { signUpAction } from '@/lib/auth/actions';

import { useActionSubmit } from './use-action-submit';

export function SignUpForm() {
  const t = useTranslations('auth.signup');
  const tv = useTranslations('validation');
  const te = useTranslations('errors');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });
  const { submit, error, pending } = useActionSubmit((values: SignUpInput) => signUpAction(values));
  const fieldError = (code?: string) => (code ? tv(code as ValidationCode) : undefined);

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      {error && <FormAlert>{te(error)}</FormAlert>}
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
        autoComplete="new-password"
        hint={t('passwordHint')}
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
      <p className="text-sm">
        {t('haveAccount')}{' '}
        <Link href="/login" className="text-brand-500 underline-offset-4 hover:underline">
          {t('signInLink')}
        </Link>
      </p>
    </form>
  );
}
