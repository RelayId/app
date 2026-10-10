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
    artifacts?: Array<{
        format: 'apk' | 'aab';
        architecture?: string;
        artifactUrl: string;
        sha256?: string;
    }>;
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

export function getDirectApkUrl(artifact: UpdateArtifact): string {
    const apk = artifact.artifacts?.find((item) => item.format === 'apk');
    return apk?.artifactUrl || artifact.artifactUrl;
}

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
        if (artifact.artifacts !== undefined) {
            for (const item of artifact.artifacts) {
                if (item.format !== 'apk' && item.format !== 'aab') throw new Error('Invalid update artifact format');
                if (!/^https:\/\/github\.com\/RelayId\//u.test(item.artifactUrl)) throw new Error('Untrusted update artifact URL');
                if (item.sha256 !== undefined && item.sha256 !== '' && !/^[a-f0-9]{64}$/u.test(item.sha256)) throw new Error('Invalid update digest');
            }
        }
        if (artifact.sha256 !== undefined && artifact.sha256 !== '' && !/^[a-f0-9]{64}$/u.test(artifact.sha256)) throw new Error('Invalid update digest');
    }
}
