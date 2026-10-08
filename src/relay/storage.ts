import * as SecureStore from 'expo-secure-store';
import { encodeBase64Url } from './base64';
import { decodeBase64Url } from './base64';
import type { Account } from './models';
import { randomBytes } from './base64';

const indexKey = 'relayid.accounts.index';
const manifestKey = (id: string) => `relayid.account.${encodeURIComponent(id)}.manifest`;
const watchCapabilityKey = (id: string) => `relayid.account.${encodeURIComponent(id)}.watch-capability`;
const chunkKey = (prefix: string, index: number) => `${prefix}.${index}`;
const chunkSize = 900;
const maximumAccounts = 8;

export type AccountManifest = {
    prefix: string;
    chunks: number;
};

export type SecureStoreOptions = Parameters<typeof SecureStore.setItemAsync>[2];

const sensitiveOptions: SecureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export function accountBytes(account: Account): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(account));
}

async function readIndex(): Promise<string[]> {
    const raw = await SecureStore.getItemAsync(indexKey);
    if (!raw) return [];

    const ids = JSON.parse(raw) as unknown;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
        throw new Error('Relay account index is invalid');
    }

    return ids;
}

async function readManifest(id: string): Promise<AccountManifest | null> {
    const raw = await SecureStore.getItemAsync(manifestKey(id));
    if (!raw) return null;

    const manifest = JSON.parse(raw) as Partial<AccountManifest>;
    const chunks = manifest.chunks;
    if (
        typeof manifest.prefix !== 'string' ||
        typeof chunks !== 'number' ||
        !Number.isSafeInteger(chunks) ||
        chunks < 1 ||
        chunks > 128
    ) {
        throw new Error('Relay account manifest is invalid');
    }

    return { prefix: manifest.prefix, chunks };
}

async function readAccount(id: string): Promise<Account> {
    const manifest = await readManifest(id);
    if (!manifest) throw new Error('Relay account record is incomplete');

    const chunks = await Promise.all(
        Array.from({ length: manifest.chunks }, (_, index) =>
            SecureStore.getItemAsync(chunkKey(manifest.prefix, index)),
        ),
    );

    if (chunks.some((chunk) => chunk === null)) throw new Error('Relay account record is incomplete');

    const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + decodeBase64Url(chunk ?? '').length, 0));
    let offset = 0;
    for (const chunk of chunks) {
        const decoded = decodeBase64Url(chunk ?? '');
        bytes.set(decoded, offset);
        offset += decoded.length;
    }

    const account = JSON.parse(new TextDecoder().decode(bytes)) as Account;
    if (
        !account.id ||
        account.id !== id ||
        !account.origin ||
        !account.credential ||
        !account.p256Alias ||
        !account.mldsaSeedKey
    ) {
        throw new Error('Relay account record is invalid');
    }

    return account;
}

async function deleteManifestChunks(manifest: AccountManifest | null): Promise<void> {
    if (!manifest) return;
    await Promise.all(
        Array.from({ length: manifest.chunks }, (_, index) =>
            SecureStore.deleteItemAsync(chunkKey(manifest.prefix, index)),
        ),
    );
}

export async function loadAccounts(): Promise<Account[]> {
    const ids = await readIndex();
    return Promise.all(ids.map((id) => readAccount(id)));
}

export async function saveAccount(account: Account, replacingAccountID?: string): Promise<void> {
    const ids = await readIndex();
    if (!ids.includes(account.id) && ids.length >= maximumAccounts)
        throw new Error('This device already has the maximum number of Relay accounts');

    const existingAccounts = await Promise.all(ids.filter((id) => id !== account.id).map((id) => readAccount(id)));
    if (existingAccounts.some((existing) => existing.origin === account.origin && existing.id !== replacingAccountID)) {
        throw new Error('This Relay is already connected');
    }

    const previous = await readManifest(account.id);
    const prefix = `relayid.account.${encodeURIComponent(account.id)}.${encodeBase64Url(randomBytes(12))}`;
    const bytes = accountBytes(account);
    const chunks = Math.ceil(bytes.length / chunkSize);
    const manifest: AccountManifest = { prefix, chunks };
    const writtenKeys: string[] = [];

    try {
        for (let index = 0; index < chunks; index += 1) {
            const chunk = bytes.slice(index * chunkSize, (index + 1) * chunkSize);
            const key = chunkKey(prefix, index);
            await SecureStore.setItemAsync(key, encodeBase64Url(chunk), sensitiveOptions);
            writtenKeys.push(key);
        }

        await SecureStore.setItemAsync(manifestKey(account.id), JSON.stringify(manifest), sensitiveOptions);
        await SecureStore.setItemAsync(indexKey, JSON.stringify([...new Set([...ids, account.id])]), sensitiveOptions);
    } catch (error) {
        await Promise.all(writtenKeys.map((key) => SecureStore.deleteItemAsync(key)));
        if (previous) {
            await SecureStore.setItemAsync(manifestKey(account.id), JSON.stringify(previous), sensitiveOptions);
        } else {
            await SecureStore.deleteItemAsync(manifestKey(account.id));
        }
        throw error;
    }

    if (previous) {
        try {
            await deleteManifestChunks(previous);
        } catch {}
    }
}

export async function deleteAccountMetadata(account: Account): Promise<void> {
    const manifest = await readManifest(account.id);
    await deleteManifestChunks(manifest);
    await SecureStore.deleteItemAsync(manifestKey(account.id));

    const ids = (await readIndex()).filter((id) => id !== account.id);
    await SecureStore.setItemAsync(indexKey, JSON.stringify(ids), sensitiveOptions);
}

export async function saveSecret(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, sensitiveOptions);
}

export const readSecret = (key: string) => SecureStore.getItemAsync(key);
export const deleteSecret = (key: string) => SecureStore.deleteItemAsync(key);

export async function saveWatchCapability(
    id: string,
    capability: { token: string; expires_at: string },
): Promise<void> {
    await SecureStore.setItemAsync(watchCapabilityKey(id), JSON.stringify(capability), sensitiveOptions);
}

export async function readWatchCapability(id: string): Promise<{ token: string; expires_at: string } | null> {
    const raw = await SecureStore.getItemAsync(watchCapabilityKey(id));
    if (!raw) return null;

    const capability = JSON.parse(raw) as Partial<{ token: string; expires_at: string }>;
    if (typeof capability.token !== 'string' || typeof capability.expires_at !== 'string') {
        throw new Error('Relay watch capability is invalid');
    }

    return { token: capability.token, expires_at: capability.expires_at };
}

export const deleteWatchCapability = (id: string) => SecureStore.deleteItemAsync(watchCapabilityKey(id));
