import * as Application from 'expo-application';
import { Platform } from 'react-native';

export const UPDATE_MANIFEST_URL =
    process.env.EXPO_PUBLIC_UPDATE_MANIFEST_URL?.trim() || 'https://relayid.github.io/manifest/manifest.json';

export type UpdateArtifact = {
    package: string;
    versionCode: number;
    versionName: string;
    downloadUrl: string;
    artifactUrl: string;
    sha256?: string;
    minSupportedVersionCode: number;
    mandatory: boolean;
};

export type RelayUpdateManifest = {
    schema: 1;
    generatedAt: string;
    android: UpdateArtifact;
    wear: UpdateArtifact;
};

export type AvailableUpdate = UpdateArtifact & { currentVersionCode: number };

export type UpdateCheckResult = {
    app?: AvailableUpdate;
    watch?: UpdateArtifact;
};

export async function checkForUpdates(): Promise<UpdateCheckResult> {
    if (Platform.OS !== 'android') return {};

    const response = await fetch(UPDATE_MANIFEST_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Update manifest request failed: ${response.status}`);

    const manifest = (await response.json()) as Partial<RelayUpdateManifest>;
    validateManifest(manifest);

    const currentVersionCode = Number.parseInt(Application.nativeBuildVersion || '0', 10);
    const result: UpdateCheckResult = {};
    if (manifest.android.versionCode > currentVersionCode) {
        result.app = { ...manifest.android, currentVersionCode };
    }

    if (manifest.wear.versionCode > 0) result.watch = manifest.wear;
    return result;
}

function validateManifest(value: Partial<RelayUpdateManifest>): asserts value is RelayUpdateManifest {
    if (value.schema !== 1 || typeof value.generatedAt !== 'string') throw new Error('Unsupported update manifest');

    for (const artifact of [value.android, value.wear]) {
        if (!artifact || typeof artifact !== 'object') throw new Error('Incomplete update manifest');
        if (!/^com\.relayid\.(app|watch)$/u.test(artifact.package)) throw new Error('Unexpected update package');
        if (!Number.isInteger(artifact.versionCode) || artifact.versionCode < 1) throw new Error('Invalid update version');
        if (!/^https:\/\/relayid\.github\.io\/manifest\//u.test(artifact.downloadUrl)) throw new Error('Untrusted update URL');
        if (!/^https:\/\/github\.com\/RelayId\//u.test(artifact.artifactUrl)) throw new Error('Untrusted update artifact URL');
        if (artifact.sha256 !== undefined && artifact.sha256 !== '' && !/^[a-f0-9]{64}$/u.test(artifact.sha256)) throw new Error('Invalid update digest');
    }
}
