jest.mock('react-native-quick-crypto', () => ({
    createHash: (algorithm: string) => {
        const nodeCrypto = require('crypto') as {
            createHash: (name: string) => { update: (value: Uint8Array) => { digest: () => Uint8Array } };
        };
        return nodeCrypto.createHash(algorithm);
    },
}));

jest.mock('react-native-quick-base64', () => ({
    fromByteArray: (bytes: Uint8Array, urlSafe = false) => {
        const encoded = btoa(String.fromCharCode(...bytes));
        return urlSafe ? encoded.replace(/\+/gu, '-').replace(/\//gu, '_') : encoded;
    },
    toByteArray: (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0)),
}));

import { canonicalRequest } from '../src/relay/signing';

const nonce = Uint8Array.from({ length: 24 }, (_, index) => index);

describe('canonical request bytes', () => {
    it('matches the real SHA-512 protocol vector without a mocked digest', async () => {
        const canonical = await canonicalRequest(
            'post',
            '/api/codes',
            '1735689600',
            'AAECAwQFBgcICQoLDA0ODxAREhMUFRYX',
            new TextEncoder().encode('{}'),
        );

        expect(new TextDecoder().decode(canonical)).toBe(
            [
                'relay-device-request',
                'POST',
                '/api/codes',
                '1735689600',
                'AAECAwQFBgcICQoLDA0ODxAREhMUFRYX',
                'J8dGcK23UHX60FjVzq97IMTneGyDuuijL2Jvl4KvNMmjPCBG72D9Knh403jin-yFGAa72aZ4ePOp8c2kgwdj_Q',
            ].join('\n'),
        );
    });

    it('uppercases methods and rejects query strings', async () => {
        const canonical = await canonicalRequest(
            'get',
            '/api/codes',
            '1735689600',
            'AAECAwQFBgcICQoLDA0ODxAREhMUFRYX',
            new TextEncoder().encode('{}'),
        );
        expect(new TextDecoder().decode(canonical)).toContain('\nGET\n');
        await expect(
            canonicalRequest(
                'POST',
                '/api/codes?x=1',
                '1735689600',
                'AAECAwQFBgcICQoLDA0ODxAREhMUFRYX',
                new TextEncoder().encode('{}'),
            ),
        ).rejects.toThrow('query');
    });

    it('changes the digest when body whitespace changes', async () => {
        const compact = await canonicalRequest(
            'POST',
            '/api/codes',
            '1735689600',
            'AAECAwQFBgcICQoLDA0ODxAREhMUFRYX',
            new TextEncoder().encode('{}'),
        );
        const spaced = await canonicalRequest(
            'POST',
            '/api/codes',
            '1735689600',
            'AAECAwQFBgcICQoLDA0ODxAREhMUFRYX',
            new TextEncoder().encode('{ }'),
        );
        expect(new TextDecoder().decode(compact)).not.toBe(new TextDecoder().decode(spaced));
    });

    it('uses the supplied 24-byte nonce encoding', () => {
        expect(
            btoa(String.fromCharCode(...nonce))
                .replace(/\+/gu, '-')
                .replace(/\//gu, '_')
                .replace(/=+$/u, ''),
        ).toBe('AAECAwQFBgcICQoLDA0ODxAREhMUFRYX');
    });
});
