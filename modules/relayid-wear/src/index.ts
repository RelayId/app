import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type RelayIdWearNativeModule = {
    publishState(payload: string): void;
    setWatchCredentials(payload: string): void;
    getConnectedWatchCount(): Promise<number>;
    getWatchStatus(): Promise<{ connected: number; installed: number }>;
    getConnectedWatches(): Promise<WatchDevice[]>;
    getWatchInstallerStatus(targetNodeId: string): Promise<string | null>;
    installWatchArtifact(url: string, targetNodeId: string): Promise<boolean>;
};

export type WatchDevice = { id: string; displayName: string; nearby: boolean };

const nativeModule =
    Platform.OS === 'android' ? requireOptionalNativeModule<RelayIdWearNativeModule>('RelayIdWear') : null;

export function publishWearState(payload: unknown): void {
    nativeModule?.publishState(JSON.stringify(payload));
}

export function setWatchCredentials(credentials: Record<string, string>): void {
    nativeModule?.setWatchCredentials(JSON.stringify(credentials));
}

export function getConnectedWatchCount(): Promise<number> {
    return nativeModule?.getConnectedWatchCount() ?? Promise.resolve(0);
}

export function getWatchStatus(): Promise<{ connected: number; installed: number }> {
    return nativeModule?.getWatchStatus() ?? Promise.resolve({ connected: 0, installed: 0 });
}

export function getConnectedWatches(): Promise<WatchDevice[]> {
    return nativeModule?.getConnectedWatches() ?? Promise.resolve([]);
}

export function getWatchInstallerStatus(targetNodeId: string): Promise<string | null> {
    return nativeModule?.getWatchInstallerStatus(targetNodeId) ?? Promise.resolve(null);
}

export function installWatchArtifact(url: string, targetNodeId: string): Promise<boolean> {
    return nativeModule?.installWatchArtifact(url, targetNodeId) ?? Promise.resolve(false);
}
