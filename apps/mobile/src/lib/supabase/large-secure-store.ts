import * as aesjs from 'aes-js';

/**
 * Session storage for supabase-js on mobile (K3).
 *
 * SecureStore (Keychain / Keystore) is the safe place for secrets but values
 * over ~2 KB are not supported, and a Supabase session is larger. So each value
 * is encrypted with a fresh random AES-256 key: the ciphertext goes to
 * AsyncStorage, the key to SecureStore. Neither half is useful alone.
 * Keys are stored "when unlocked, this device only": they are not included in
 * device backups and cannot be restored onto another phone.
 */
export interface SecureKeyStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface PlainStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type SessionStorage = PlainStore;

export function createLargeSecureStore(deps: {
  secure: SecureKeyStore;
  plain: PlainStore;
  randomBytes: (length: number) => Uint8Array;
}): SessionStorage {
  const encrypt = async (key: string, value: string) => {
    // A new key per write, so the fixed CTR counter never reuses a keystream.
    const encryptionKey = deps.randomBytes(32);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await deps.secure.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encrypted);
  };

  const decrypt = async (key: string, value: string) => {
    const keyHex = await deps.secure.getItemAsync(key);
    if (!keyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(keyHex),
      new aesjs.Counter(1),
    );
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
  };

  return {
    async getItem(key) {
      const encrypted = await deps.plain.getItem(key);
      if (!encrypted) return null;
      // A missing or corrupt half means "no session", never a crash.
      return decrypt(key, encrypted).catch(() => null);
    },
    async setItem(key, value) {
      await deps.plain.setItem(key, await encrypt(key, value));
    },
    async removeItem(key) {
      await deps.plain.removeItem(key);
      await deps.secure.deleteItemAsync(key);
    },
  };
}
