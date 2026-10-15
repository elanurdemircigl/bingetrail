import type { ReactNode } from 'react';

const TONES = {
  error: 'border-brand-600 bg-brand-600/10',
  success: 'border-emerald-500 bg-emerald-500/10',
} as const;

/** Form-level message announced to screen readers. */
export function FormAlert({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2 text-sm ${TONES[tone]}`}
    >
      {children}
    </p>
  );
}
