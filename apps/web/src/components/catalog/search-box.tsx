'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState, useTransition } from 'react';

import { useRouter } from '@/i18n/navigation';

const DEBOUNCE_MS = 350;

/**
 * Search input whose state lives in the URL (?q=), so results are rendered on
 * the server, are shareable and work with the back button. Typing updates the
 * URL after a short pause; Enter searches immediately. Without JavaScript the
 * form still submits as a plain GET.
 */
export function SearchBox({ initialQuery }: { initialQuery: string }) {
  const t = useTranslations('catalog.search');
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const query = value.trim();
    if (query === initialQuery) return;
    const timer = setTimeout(() => {
      startTransition(() =>
        router.replace({ pathname: '/search', query: query ? { q: query } : {} }),
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, initialQuery, router]);

  return (
    <form
      role="search"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        startTransition(() =>
          router.replace({ pathname: '/search', query: query ? { q: query } : {} }),
        );
      }}
      className="flex flex-col gap-2"
    >
      <label htmlFor={inputId} className="text-sm font-medium">
        {t('label')}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          name="q"
          type="search"
          value={value}
          maxLength={100}
          autoComplete="off"
          placeholder={t('placeholder')}
          onChange={(event) => setValue(event.target.value)}
          className="bg-surface border-surface-muted focus-visible:ring-brand-500 min-w-0 flex-1 rounded-lg border px-3 py-2 outline-none focus-visible:ring-2"
        />
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500 rounded-lg px-4 py-2 font-semibold text-white outline-none focus-visible:ring-2"
        >
          {t('submit')}
        </button>
      </div>
      <p aria-live="polite" className="text-ink-muted h-5 text-sm">
        {pending ? t('searching') : ''}
      </p>
    </form>
  );
}
