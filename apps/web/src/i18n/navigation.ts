import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/** Locale-aware Link/redirect/pathname helpers; use these instead of next/link in UI. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
