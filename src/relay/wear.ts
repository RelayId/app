import { getConnectedWatchCount, publishWearState } from 'relayid-wear';
import type { Account } from './models';
import { Platform } from 'react-native';

export type WearState = {
    relays: Array<{
        id: string;
        name: string;
        email: string;
        host: string;
        origin: string;
        watch_token?: string;
    }>;
    selected_id?: string;
    code?: string;
    groups?: number;
    expires_in?: number;
};

export { getConnectedWatchCount };

export function publishRelayState(
    accounts: Account[],
    selectedAccount?: Account,
    code?: string,
    expiresAt?: string,
    watchTokens: Map<string, string> = new Map(),
): void {
    if (Platform.OS !== 'android') return;

    const expiresIn = expiresAt
        ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
        : undefined;

    const state: WearState = {
        relays: accounts.map((account) => ({
            id: account.id,
            name: account.email,
            email: account.email,
            host: account.origin.replace(/^https?:\/\//u, '').replace(/\/$/u, ''),
            origin: account.origin,
            watch_token: watchTokens.get(account.id),
        })),
        selected_id: selectedAccount?.id,
        code,
        groups: selectedAccount?.mobileCode?.groups,
        expires_in: expiresIn,
    };

    publishWearState(state);
}
