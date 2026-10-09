import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type RelayIdWearNativeModule = {
    publishState(payload: string): void;
    getConnectedWatchCount(): Promise<number>;
};

const nativeModule =
    Platform.OS === 'android' ? requireOptionalNativeModule<RelayIdWearNativeModule>('RelayIdWear') : null;

export function publishWearState(payload: unknown): void {
    nativeModule?.publishState(JSON.stringify(payload));
}

export function getConnectedWatchCount(): Promise<number> {
    return nativeModule?.getConnectedWatchCount() ?? Promise.resolve(0);
}
