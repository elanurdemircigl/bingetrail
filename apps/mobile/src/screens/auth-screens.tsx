import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Controller, useForm, type Control, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { LOCALES } from '@bingetrail/i18n';
import {
  forgotPasswordSchema,
  signInSchema,
  signUpSchema,
  type AuthErrorCode,
  type ValidationCode,
} from '@bingetrail/shared';

import { Alert, Button, LinkText, Screen, TextField, Title } from '@/components/ui';
import { requestPasswordReset, signIn, signUp } from '@/lib/auth/actions';
import { currentLocale, setAppLocale } from '@/lib/i18n';

/** Translates a Zod issue code from the shared schemas. */
export function useFieldError() {
  const { t } = useTranslation();
  return (code?: string) => (code ? t(`validation.${code as ValidationCode}`) : undefined);
}

/** RHF-controlled text field. */
export function Field<T extends FieldValues>({
  control,
  name,
  label,
  error,
  secure = false,
  email = false,
  hint,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  error?: string | undefined;
  secure?: boolean;
  email?: boolean;
  hint?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <TextField
          label={label}
          value={field.value as string}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={error}
          hint={hint}
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={email ? 'email-address' : 'default'}
          autoComplete={email ? 'email' : secure ? 'password' : 'off'}
          textContentType={email ? 'emailAddress' : secure ? 'password' : 'none'}
        />
      )}
    />
  );
}

export function LanguageToggle() {
  const { t, i18n } = useTranslation();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('languages.label')}
      className="flex-row justify-end gap-3"
    >
      {LOCALES.map((locale) => (
        <Pressable
          key={locale}
          accessibilityRole="radio"
          accessibilityState={{ selected: i18n.language === locale }}
          onPress={() => void setAppLocale(locale)}
          className="min-h-11 justify-center"
        >
          <Text className={i18n.language === locale ? 'font-semibold text-ink' : 'text-ink-muted'}>
            {t(`languages.${locale}`)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-bold text-brand-500">{t('app.name')}</Text>
        <LanguageToggle />
      </View>
      <Title>{title}</Title>
      {children}
    </Screen>
  );
}

export function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const fieldError = useFieldError();
  const [error, setError] = useState<AuthErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    setPending(true);
    const result = await signIn(values).finally(() => setPending(false));
    if (!result.ok) setError(result.error);
    // On success the session listener routes into the app.
  });

  return (
    <AuthShell title={t('auth.login.title')}>
      {error && <Alert>{t(`errors.${error}`)}</Alert>}
      <Field
        control={control}
        name="email"
        label={t('auth.login.email')}
        email
        error={fieldError(formState.errors.email?.message)}
      />
      <Field
        control={control}
        name="password"
        label={t('auth.login.password')}
        secure
        error={fieldError(formState.errors.password?.message)}
      />
      <Button
        label={t('auth.login.submit')}
        pendingLabel={t('auth.login.submitting')}
        pending={pending}
        onPress={submit}
      />
      <LinkText label={t('auth.login.forgot')} onPress={() => router.push('/forgot-password')} />
      <LinkText
        label={`${t('auth.login.noAccount')} ${t('auth.login.signUpLink')}`}
        onPress={() => router.push('/signup')}
      />
    </AuthShell>
  );
}

export function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const fieldError = useFieldError();
  const [error, setError] = useState<AuthErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    setPending(true);
    const result = await signUp(values, currentLocale()).finally(() => setPending(false));
    if (!result.ok) setError(result.error);
    else if ('needsConfirmation' in result) setCheckEmail(true);
  });

  if (checkEmail) {
    return (
      <AuthShell title={t('auth.checkEmail.title')}>
        <Text className="text-ink">{t('auth.checkEmail.signupBody')}</Text>
        <LinkText
          label={t('auth.checkEmail.backToLogin')}
          onPress={() => router.replace('/login')}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.signup.title')}>
      {error && <Alert>{t(`errors.${error}`)}</Alert>}
      <Field
        control={control}
        name="email"
        label={t('auth.signup.email')}
        email
        error={fieldError(formState.errors.email?.message)}
      />
      <Field
        control={control}
        name="password"
        label={t('auth.signup.password')}
        secure
        hint={t('auth.signup.passwordHint')}
        error={fieldError(formState.errors.password?.message)}
      />
      <Field
        control={control}
        name="confirmPassword"
        label={t('auth.signup.confirmPassword')}
        secure
        error={fieldError(formState.errors.confirmPassword?.message)}
      />
      <Button
        label={t('auth.signup.submit')}
        pendingLabel={t('auth.signup.submitting')}
        pending={pending}
        onPress={submit}
      />
      <LinkText
        label={`${t('auth.signup.haveAccount')} ${t('auth.signup.signInLink')}`}
        onPress={() => router.replace('/login')}
      />
    </AuthShell>
  );
}

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const fieldError = useFieldError();
  const [error, setError] = useState<AuthErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    setPending(true);
    const result = await requestPasswordReset(values).finally(() => setPending(false));
    if (!result.ok) setError(result.error);
    // Same next step whether or not the address exists (no enumeration).
    else router.push({ pathname: '/reset-password', params: { email: values.email } });
  });

  return (
    <AuthShell title={t('auth.forgot.title')}>
      <Text className="text-ink-muted">{t('auth.forgot.description')}</Text>
      {error && <Alert>{t(`errors.${error}`)}</Alert>}
      <Field
        control={control}
        name="email"
        label={t('auth.forgot.email')}
        email
        error={fieldError(formState.errors.email?.message)}
      />
      <Button
        label={t('auth.forgot.submit')}
        pendingLabel={t('auth.forgot.submitting')}
        pending={pending}
        onPress={submit}
      />
      <LinkText label={t('auth.forgot.backToLogin')} onPress={() => router.replace('/login')} />
    </AuthShell>
  );
}
