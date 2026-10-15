import { useId, type ComponentProps } from 'react';

type FormFieldProps = ComponentProps<'input'> & {
  label: string;
  /** Already-translated error message. */
  error?: string | undefined;
  hint?: string | undefined;
};

/** Labelled input with accessible hint and error wiring (aria-describedby/invalid). */
export function FormField({ label, error, hint, id, ...inputProps }: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="bg-surface border-surface-muted text-ink focus-visible:ring-brand-500 aria-[invalid=true]:border-brand-500 rounded-lg border px-3 py-2 outline-none focus-visible:ring-2"
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="text-ink-muted text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-brand-500 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
