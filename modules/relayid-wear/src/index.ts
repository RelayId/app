import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type WearRequest = {
    relay_id: string;
};

export type RelayIdWearNativeModule = {
    publishState(payload: string): void;
    consumeRequests(): string;
};

const nativeModule =
    Platform.OS === 'android' ? requireOptionalNativeModule<RelayIdWearNativeModule>('RelayIdWear') : null;

export function publishWearState(payload: unknown): void {
    nativeModule?.publishState(JSON.stringify(payload));
}

export function consumeWearRequests(): WearRequest[] {
    if (!nativeModule) return [];

    try {
        const value = JSON.parse(nativeModule.consumeRequests()) as unknown;
        return Array.isArray(value)
            ? value.filter((item): item is WearRequest => {
                  return (
                      typeof item === 'object' && item !== null && typeof (item as WearRequest).relay_id === 'string'
                  );
              })
            : [];
    } catch {
        return [];
    }
}
