import { createLargeSecureStore, type PlainStore, type SecureKeyStore } from './large-secure-store';

function memory() {
  const plain = new Map<string, string>();
  const secure = new Map<string, string>();
  let counter = 0;
  const store = createLargeSecureStore({
    plain: {
      getItem: async (k) => plain.get(k) ?? null,
      setItem: async (k, v) => void plain.set(k, v),
      removeItem: async (k) => void plain.delete(k),
    } satisfies PlainStore,
    secure: {
      getItemAsync: async (k) => secure.get(k) ?? null,
      setItemAsync: async (k, v) => void secure.set(k, v),
      deleteItemAsync: async (k) => void secure.delete(k),
    } satisfies SecureKeyStore,
    // Deterministic but different per call.
    randomBytes: (n) => Uint8Array.from({ length: n }, (_, i) => (i + 1 + counter++ * 7) % 256),
  });
  return { store, plain, secure };
}

const SESSION = JSON.stringify({
  access_token: 'eyJ.secret.token',
  refresh_token: 'r-123',
  user: { id: 'u' },
});

describe('LargeSecureStore', () => {
  it('round-trips a large session', async () => {
    const { store } = memory();
    const big = SESSION + 'x'.repeat(5000); // beyond SecureStore's ~2 KB limit
    await store.setItem('sb-auth-token', big);
    expect(await store.getItem('sb-auth-token')).toBe(big);
  });

  it('keeps only ciphertext in AsyncStorage and only the key in SecureStore', async () => {
    const { store, plain, secure } = memory();
    await store.setItem('sb-auth-token', SESSION);
    expect(plain.get('sb-auth-token')).not.toContain('secret');
    expect(plain.get('sb-auth-token')).toMatch(/^[0-9a-f]+$/);
    expect(secure.get('sb-auth-token')).toMatch(/^[0-9a-f]{64}$/); // AES-256 key
  });

  it('uses a fresh key on every write', async () => {
    const { store, secure } = memory();
    await store.setItem('k', SESSION);
    const first = secure.get('k');
    await store.setItem('k', SESSION);
    expect(secure.get('k')).not.toBe(first);
  });

  it('treats a missing half as "no session"', async () => {
    const { store, secure } = memory();
    await store.setItem('k', SESSION);
    secure.delete('k');
    expect(await store.getItem('k')).toBeNull();
    expect(await store.getItem('never-written')).toBeNull();
  });

  it('removes both halves', async () => {
    const { store, plain, secure } = memory();
    await store.setItem('k', SESSION);
    await store.removeItem('k');
    expect(plain.has('k') || secure.has('k')).toBe(false);
  });
});
