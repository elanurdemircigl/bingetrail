import Image from 'next/image';

import { posterUrl } from '@/lib/catalog';

/** Poster image from the TMDB CDN, or a neutral placeholder when there is none. */
export function Poster({
  path,
  title,
  placeholder,
  size = 'w342',
  priority = false,
}: {
  path: string | null;
  title: string;
  placeholder: string;
  size?: 'w185' | 'w342';
  priority?: boolean;
}) {
  if (!path) {
    return (
      <div
        role="img"
        aria-label={`${title} — ${placeholder}`}
        className="bg-surface-muted text-ink-muted rounded-card flex aspect-[2/3] w-full items-center justify-center p-2 text-center text-xs"
      >
        {placeholder}
      </div>
    );
  }
  const width = size === 'w185' ? 185 : 342;
  return (
    <Image
      src={posterUrl(path, size)}
      alt={title}
      width={width}
      height={Math.round(width * 1.5)}
      priority={priority}
      sizes="(max-width: 640px) 45vw, 185px"
      className="rounded-card aspect-[2/3] w-full object-cover"
    />
  );
}
