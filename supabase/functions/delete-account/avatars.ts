/** The subset of the Storage bucket API used to empty a user's avatar folder. */
export interface BucketApi {
  list(
    prefix: string,
    options: { limit: number; offset: number },
  ): Promise<{ data: Array<{ name: string; id: string | null }> | null; error: unknown }>;
  remove(paths: string[]): Promise<{ data: unknown; error: unknown }>;
}

const PAGE_SIZE = 100;
/** Far above any real avatar folder; beyond it something is wrong, so abort. */
const MAX_OBJECTS = 10_000;

export class StorageCleanupError extends Error {
  override name = 'StorageCleanupError';
}

/** Collects every object path under `prefix`, descending into sub-folders. */
async function collect(bucket: BucketApi, prefix: string, found: string[]): Promise<void> {
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await bucket.list(prefix, { limit: PAGE_SIZE, offset });
    if (error || !data) throw new StorageCleanupError('list failed');
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      // Storage lists folders as entries without an id.
      if (entry.id === null) await collect(bucket, path, found);
      else found.push(path);
      if (found.length > MAX_OBJECTS) throw new StorageCleanupError('too many objects');
    }
    if (data.length < PAGE_SIZE) return;
  }
}

/** Removes everything under `<userId>/`; throws if anything could not be removed. */
export async function removeUserFolder(bucket: BucketApi, userId: string): Promise<number> {
  const paths: string[] = [];
  await collect(bucket, userId, paths);
  for (let i = 0; i < paths.length; i += PAGE_SIZE) {
    const { error } = await bucket.remove(paths.slice(i, i + PAGE_SIZE));
    if (error) throw new StorageCleanupError('remove failed');
  }
  return paths.length;
}
