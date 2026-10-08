jest.mock('expo-secure-store', () => {
    const values = new Map<string, string>();
    let failManifest = false;

    return {
        WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device',
        getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
        setItemAsync: jest.fn(async (key: string, value: string) => {
            if (failManifest && key.endsWith('.manifest')) {
                failManifest = false;
                throw new Error('manifest write failed');
            }
            values.set(key, value);
        }),
        deleteItemAsync: jest.fn(async (key: string) => {
            values.delete(key);
        }),
        __values: values,
        __failManifest: () => {
            failManifest = true;
        },
    };
});

jest.mock('react-native-quick-base64', () => ({
    fromByteArray: (bytes: Uint8Array, urlSafe = false) => {
        const value = btoa(String.fromCharCode(...bytes));
        return urlSafe ? value.replace(/\+/gu, '-').replace(/\//gu, '_') : value;
    },
    toByteArray: (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0)),
}));

jest.mock('react-native-quick-crypto', () => {
    let counter = 0;
    return {
        randomBytes: jest.fn(() => {
            const bytes = new Uint8Array(12);
            bytes[11] = counter++;
            return bytes;
        }),
    };
});

import * as SecureStore from 'expo-secure-store';
import { deleteAccountMetadata } from '../src/relay/storage';
import { loadAccounts } from '../src/relay/storage';
import { saveAccount } from '../src/relay/storage';

const account = (id: string, email = 'person@example.com') => ({
    id,
    origin: 'https://relay.example.com',
    email,
    provider: 'google',
    deviceName: 'Phone',
    credential: `rdc.${id}.credential`,
    credentialExpiresAt: '2099-01-01T00:00:00Z',
    p256Alias: `p256-${id}`,
    mldsaSeedKey: `mldsa-${id}`,
});

describe('chunked account storage', () => {
    beforeEach(() => {
        (SecureStore as typeof SecureStore & { __values: Map<string, string> }).__values.clear();
    });

    it('round trips Unicode and large account metadata', async () => {
        const value = account('large', 'ž'.repeat(6000));

        await saveAccount(value);

        await expect(loadAccounts()).resolves.toEqual([value]);
    });

    it('restores the previous manifest when an update cannot commit', async () => {
        const previous = account('same', 'before@example.com');
        const updated = account('same', 'after@example.com');

        await saveAccount(previous);
        (SecureStore as typeof SecureStore & { __failManifest: () => void }).__failManifest();
        await expect(saveAccount(updated)).rejects.toThrow('manifest write failed');
        await expect(loadAccounts()).resolves.toEqual([previous]);
    });

    it('rejects a second account for the same Relay origin', async () => {
        await saveAccount(account('first'));

        await expect(saveAccount(account('second'))).rejects.toThrow('already connected');
    });

    it('allows replacing the existing account for the same Relay origin', async () => {
        const previous = account('first');
        const replacement = account('second');

        await saveAccount(previous);
        await expect(saveAccount(replacement, previous.id)).resolves.toBeUndefined();
        await expect(loadAccounts()).resolves.toEqual([previous, replacement]);
    });

    it('rejects a missing chunk and deletes metadata independently', async () => {
        const value = account('delete');

        await saveAccount(value);
        const values = (SecureStore as typeof SecureStore & { __values: Map<string, string> }).__values;
        const chunk = [...values.keys()].find(
            (key) => key.startsWith('relayid.account.delete.') && !key.endsWith('.manifest'),
        );
        if (!chunk) throw new Error('test chunk was not written');
        values.delete(chunk);
        await expect(loadAccounts()).rejects.toThrow('incomplete');

        await deleteAccountMetadata(value);
        expect([...values.keys()].some((key) => key.includes('delete'))).toBe(false);
    });
});
