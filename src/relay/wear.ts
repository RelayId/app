import { consumeWearRequests } from 'relayid-wear';
import { publishWearState } from 'relayid-wear';
import type { Account } from './models';
import { Platform } from 'react-native';

export type WearState = {
    relays: Array<{
        id: string;
        name: string;
        email: string;
        host: string;
    }>;
    selected_id?: string;
    code?: string;
    groups?: number;
    expires_in?: number;
};

export type WearRequest = {
    relay_id: string;
};

export function publishRelayState(
    accounts: Account[],
    selectedAccount?: Account,
    code?: string,
    expiresAt?: string,
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
        })),
        selected_id: selectedAccount?.id,
        code,
        groups: selectedAccount?.mobileCode?.groups,
        expires_in: expiresIn,
    };

    publishWearState(state);
}

export function getWearRequests(): WearRequest[] {
    if (Platform.OS !== 'android') return [];
    return consumeWearRequests();
}
