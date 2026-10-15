import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { z } from 'zod';

import { emailSchema, resetPasswordSchema, type AuthErrorCode } from '@bingetrail/shared';

import { Alert, Button, Loading, Screen, Title } from '@/components/ui';
import { exchangeRecoveryCode, updatePassword, verifyRecoveryCode } from '@/lib/auth/actions';

import { Field, useFieldError } from './auth-screens';

const codeSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, { error: 'required' }),
});

type Step = 'verifying' | 'code' | 'password' | 'done';

/**
 * Recovery-only password change (like the web's recovery marker): the new
 * password form appears only after THIS screen verified a recovery link (PKCE
 * code, deep link) or the emailed 6-digit code. An ordinary session cannot
 * reach it.
 */
export function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const fieldError = useFieldError();
  const params = useLocalSearchParams<{ code?: string; email?: string; error?: string }>();
  const [step, setStep] = useState<Step>(params.code ? 'verifying' : 'code');
  const [error, setError] = useState<AuthErrorCode | null>(params.error ? 'linkInvalid' : null);
  const [pending, setPending] = useState(false);
  const exchanged = useRef(false);

  // Deep link: bingetrail://reset-password?code=… (exchange exactly once).
  useEffect(() => {
    if (!params.code || exchanged.current) return;
    exchanged.current = true;
    void exchangeRecoveryCode(params.code).then((result) => {
      if (result.ok) setStep('password');
      else {
        setError(result.error);
        setStep('code');
      }
    });
  }, [params.code]);

  const codeForm = useForm({
    resolver: zodResolver(codeSchema),
    defaultValues: { email: params.email ?? '', code: '' },
  });
  const passwordForm = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const verify = codeForm.handleSubmit(async ({ email, code }) => {
    setError(null);
    setPending(true);
    const result = await verifyRecoveryCode(email, code).finally(() => setPending(false));
    if (result.ok) setStep('password');
    else setError(result.error);
  });

  const save = passwordForm.handleSubmit(async (values) => {
    setError(null);
    setPending(true);
    const result = await updatePassword(values).finally(() => setPending(false));
    if (result.ok) setStep('done');
    else setError(result.error);
  });

  if (step === 'verifying') return <Loading />;

  return (
    <Screen>
      <Title>{t('auth.reset.title')}</Title>
      {error && <Alert>{t(`errors.${error}`)}</Alert>}

      {step === 'code' && (
        <>
          <Text className="text-ink-muted">{t('auth.reset.codeHelp')}</Text>
          <Field
            control={codeForm.control}
            name="email"
            label={t('auth.forgot.email')}
            email
            error={fieldError(codeForm.formState.errors.email?.message)}
          />
          <Field
            control={codeForm.control}
            name="code"
            label={t('auth.reset.code')}
            error={codeForm.formState.errors.code ? t('auth.reset.codeInvalid') : undefined}
          />
          <Button label={t('auth.reset.verify')} pending={pending} onPress={verify} />
        </>
      )}

      {step === 'password' && (
        <>
          <Field
            control={passwordForm.control}
            name="password"
            label={t('auth.reset.password')}
            secure
            hint={t('auth.signup.passwordHint')}
            error={fieldError(passwordForm.formState.errors.password?.message)}
          />
          <Field
            control={passwordForm.control}
            name="confirmPassword"
            label={t('auth.reset.confirmPassword')}
            secure
            error={fieldError(passwordForm.formState.errors.confirmPassword?.message)}
          />
          <Button
            label={t('auth.reset.submit')}
            pendingLabel={t('auth.reset.submitting')}
            pending={pending}
            onPress={save}
          />
        </>
      )}

      {step === 'done' && (
        <>
          <Alert tone="success">{t('auth.passwordUpdated')}</Alert>
          <Button label={t('nav.home')} onPress={() => router.replace('/home')} />
        </>
      )}
    </Screen>
  );
}
