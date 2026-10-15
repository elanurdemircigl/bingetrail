import type { Progress } from '@bingetrail/shared';

/** Accessible progress bar with a visible text summary. */
export function ProgressBar({
  progress,
  label,
  text,
  testId,
}: {
  progress: Progress;
  /** Accessible name, e.g. "Watching progress". */
  label: string;
  /** Visible summary, e.g. "3/10 episodes watched". */
  text: string;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={progress.aired}
        aria-valuenow={progress.watched}
        aria-valuetext={text}
        className="bg-surface-muted h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-brand-600 h-full rounded-full transition-[width]"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p className="text-ink-muted text-sm">{text}</p>
    </div>
  );
}
