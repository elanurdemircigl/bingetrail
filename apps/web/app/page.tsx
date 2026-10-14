import { DEFAULT_LOCALE, messages } from '@bingetrail/i18n';

export default function HomePage() {
  const t = messages[DEFAULT_LOCALE];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-brand-500 text-4xl font-bold">{t.app.name}</h1>
      <p className="text-lg">{t.app.tagline}</p>
      <p className="text-ink-muted">{t.home.comingSoon}</p>
    </main>
  );
}
