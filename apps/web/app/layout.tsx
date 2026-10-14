import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { DEFAULT_LOCALE, messages } from '@bingetrail/i18n';

import './globals.css';

const t = messages[DEFAULT_LOCALE];

export const metadata: Metadata = {
  title: t.app.name,
  description: t.app.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE}>
      <body>{children}</body>
    </html>
  );
}
