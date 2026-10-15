import { signOutAction } from '@/lib/auth/actions';

/** Plain form + Server Action: works without client JavaScript. */
export function SignOutButton({ label }: { label: string }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="border-surface-muted hover:bg-surface-muted rounded-lg border px-3 py-1.5 text-sm"
      >
        {label}
      </button>
    </form>
  );
}
