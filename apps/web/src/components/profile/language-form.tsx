'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import type { Locale } from '@bingetrail/i18n';

import { useActionSubmit } from '@/components/auth/use-action-submit';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { routing } from '@/i18n/routing';
import { updateLocaleAction } from '@/lib/auth/actions';

export function LanguageForm({ current }: { current: Locale }) {
  const t = useTranslations('profile');
  const tl = useTranslations('languages');
  const te = useTranslations('errors');
  const selectId = useId();
  const [locale, setLocale] = useState<Locale>(current);
  const { submit, error, pending } = useActionSubmit((value: Locale) => updateLocaleAction(value));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(locale);
      }}
      className="flex flex-col gap-3"
    >
      {error && <FormAlert>{te(error)}</FormAlert>}
      <label htmlFor={selectId} className="text-sm font-medium">
        {t('language')}
      </label>
      <select
        id={selectId}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        aria-describedby={`${selectId}-help`}
        className="bg-surface border-surface-muted focus-visible:ring-brand-500 max-w-xs rounded-lg border px-3 py-2 outline-none focus-visible:ring-2"
      >
        {routing.locales.map((option) => (
          <option key={option} value={option}>
            {tl(option)}
          </option>
        ))}
      </select>
      <p id={`${selectId}-help`} className="text-ink-muted text-xs">
        {t('languageHelp')}
      </p>
      <div>
        <SubmitButton pending={pending} pendingLabel={t('saving')}>
          {t('save')}
        </SubmitButton>
      </div>
    </form>
  );
}
