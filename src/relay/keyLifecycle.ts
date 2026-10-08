import { isSensorAvailable } from '@sbaiahmed1/react-native-biometrics';
import { deleteKeys } from '@sbaiahmed1/react-native-biometrics';
import { keyExists } from '@sbaiahmed1/react-native-biometrics';
import { deleteAccountMetadata } from './storage';
import { deleteSecret } from './storage';
import type { Account } from './models';
import { readSecret } from './storage';

export async function assertDeviceSecurityAvailable(): Promise<void> {
    const security = await isSensorAvailable();
    if (security.isDeviceSecure) return;

    throw new Error('Set a device PIN, password, or biometric lock before enrolling this Relay.');
}

export async function ensureP256Deleted(alias: string): Promise<void> {
    if (!(await keyExists(alias))) return;

    const result = await deleteKeys(alias);
    if (!result.success || (await keyExists(alias))) {
        throw new Error('P-256 key could not be removed');
    }
}

async function ensureMLDSADeleted(seedKey: string): Promise<void> {
    await deleteSecret(seedKey);
    if ((await readSecret(seedKey)) !== null) {
        throw new Error('ML-DSA seed could not be removed');
    }
}

export async function removeLocalAccount(account: Account): Promise<void> {
    const failures: string[] = [];

    try {
        await ensureP256Deleted(account.p256Alias);
    } catch (error) {
        failures.push(error instanceof Error ? error.message : 'P-256 cleanup failed');
    }

    try {
        await ensureMLDSADeleted(account.mldsaSeedKey);
    } catch (error) {
        failures.push(error instanceof Error ? error.message : 'ML-DSA cleanup failed');
    }

    if (failures.length > 0) {
        throw new Error(failures.join('; '));
    }

    await deleteAccountMetadata(account);
}

export async function removeAllLocalAccounts(accounts: Account[]): Promise<void> {
    const failures: string[] = [];

    for (const account of accounts) {
        try {
            await removeLocalAccount(account);
        } catch (error) {
            failures.push(error instanceof Error ? error.message : `Could not remove ${account.origin}`);
        }
    }

    if (failures.length > 0) throw new Error(failures.join('; '));
}

export async function cleanupUnpersistedKeys(alias: string, seedKey: string): Promise<string[]> {
    const failures: string[] = [];

    try {
        await ensureP256Deleted(alias);
    } catch (error) {
        failures.push(error instanceof Error ? error.message : 'P-256 cleanup failed');
    }

    try {
        await ensureMLDSADeleted(seedKey);
    } catch (error) {
        failures.push(error instanceof Error ? error.message : 'ML-DSA cleanup failed');
    }

    return failures;
}
