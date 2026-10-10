jest.mock('expo-application', () => ({ nativeBuildVersion: '1' }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import { checkForUpdates, getDirectApkUrl } from '../src/relay/updates';

describe('update manifest', () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, 'fetch', {
            configurable: true,
            writable: true,
            value: jest.fn(),
        });
    });

    afterEach(() => jest.clearAllMocks());

    it('returns a newer Android build and the Wear artifact', async () => {
        (globalThis.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                schema: 1,
                generatedAt: '2026-10-10T00:00:00.000Z',
                android: {
                    package: 'com.relayid.app',
                    versionCode: 2,
                    versionName: '1.0.1',
                    downloadUrl: 'https://relayid.github.io/manifest/android/',
                    artifactUrl: 'https://github.com/RelayId/app/releases/download/latest/relayid-android.apk',
                    sha256: '',
                    minSupportedVersionCode: 1,
                    mandatory: false,
                },
                wear: {
                    package: 'com.relayid.app',
                    versionCode: 2,
                    versionName: '1.0.1',
                    downloadUrl: 'https://relayid.github.io/manifest/wear/',
                    artifactUrl: 'https://github.com/RelayId/watch/releases/download/wear-latest/relayid-wear.apk',
                    sha256: '',
                    minSupportedVersionCode: 1,
                    mandatory: false,
                },
            }),
        } as Response);

        const result = await checkForUpdates();
        expect(result.app?.versionCode).toBe(2);
        expect(result.watch?.versionCode).toBe(2);
    });

    it('rejects an untrusted download URL', async () => {
        (globalThis.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                schema: 1,
                generatedAt: '2026-10-10T00:00:00.000Z',
                android: { package: 'com.relayid.app', versionCode: 2, versionName: '1.0.1', downloadUrl: 'https://example.com/app.apk', artifactUrl: 'https://github.com/RelayId/app/releases/download/latest/relayid-android.apk', sha256: '', minSupportedVersionCode: 1, mandatory: false },
                wear: { package: 'com.relayid.app', versionCode: 1, versionName: '1.0.0', downloadUrl: 'https://relayid.github.io/manifest/wear/', artifactUrl: 'https://github.com/RelayId/watch/releases/download/wear-latest/relayid-wear.apk', sha256: '', minSupportedVersionCode: 1, mandatory: false },
            }),
        } as Response);

        await expect(checkForUpdates()).rejects.toThrow('Untrusted update URL');
    });

    it('selects the direct APK artifact for native installation', () => {
        expect(
            getDirectApkUrl({
                package: 'com.relayid.app',
                versionCode: 1,
                versionName: '1.0.0',
                downloadUrl: 'https://relayid.github.io/manifest/wear/',
                artifactUrl: 'https://github.com/RelayId/watch/releases/download/wear-latest/relayid-wear.apk',
                minSupportedVersionCode: 1,
                mandatory: false,
                artifacts: [
                    {
                        format: 'apk',
                        artifactUrl: 'https://github.com/RelayId/watch/releases/download/wear-latest/relayid-wear.apk',
                    },
                ],
            }),
        ).toContain('relayid-wear.apk');
    });
});
