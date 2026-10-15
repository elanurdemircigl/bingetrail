import type { ReactNode } from 'react';

export function SubmitButton({
  pending,
  children,
  pendingLabel,
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500 rounded-lg px-4 py-2 font-semibold text-white transition outline-none focus-visible:ring-2 disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
