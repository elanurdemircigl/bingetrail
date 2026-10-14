/**
 * TanStack Query key factory. Keys are hierarchical so a whole domain can be
 * invalidated with its root key. Domains are added phase by phase.
 */
const root = ['bingetrail'] as const;

export const queryKeys = {
  all: root,
  profile: {
    all: [...root, 'profile'] as const,
    detail: (userId: string) => [...root, 'profile', userId] as const,
  },
} as const;
