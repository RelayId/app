import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type RelayIdWearNativeModule = {
    publishState(payload: string): void;
};

const nativeModule =
    Platform.OS === 'android' ? requireOptionalNativeModule<RelayIdWearNativeModule>('RelayIdWear') : null;

export function publishWearState(payload: unknown): void {
    nativeModule?.publishState(JSON.stringify(payload));
}
