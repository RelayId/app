jest.mock('react-native-quick-crypto', () => ({ subtle: {} }));

jest.mock('react-native-quick-base64', () => ({
    fromByteArray: (bytes: Uint8Array, urlSafe = false) => {
        const binary = String.fromCharCode(...bytes);
        const encoded = btoa(binary);
        return urlSafe ? encoded.replace(/\+/gu, '-').replace(/\//gu, '_') : encoded;
    },
    toByteArray: (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0)),
}));

jest.mock('@sbaiahmed1/react-native-biometrics', () => ({
    InputEncoding: { Base64: 'base64' },
    getPublicKey: jest.fn(),
    signWithOptions: jest.fn(),
}));

jest.mock('../src/relay/storage', () => ({ readSecret: jest.fn() }));

import { getEnrollmentP256Jwk } from '../src/relay/crypto';
import { validateP256DerSignature } from '../src/relay/crypto';
import { p256PublicKeyToJwk } from '../src/relay/crypto';
import { getPublicKey } from '@sbaiahmed1/react-native-biometrics';

function hex(value: string): Uint8Array {
    return Uint8Array.from(value.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16));
}

function der(tag: number, content: Uint8Array): Uint8Array {
    if (content.length >= 128) throw new Error('fixture is too large');
    return Uint8Array.from([tag, content.length, ...content]);
}

function concat(...parts: Uint8Array[]): Uint8Array {
    return Uint8Array.from(parts.flatMap((part) => [...part]));
}

function base64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
}

const rawPoint = hex(
    '046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5',
);
const ecAlgorithm = der(0x30, concat(der(0x06, hex('2a8648ce3d0201')), der(0x06, hex('2a8648ce3d030107'))));
const p256Spki = der(0x30, concat(ecAlgorithm, der(0x03, concat(Uint8Array.of(0), rawPoint))));
const rsaAlgorithm = der(0x30, concat(der(0x06, hex('2a864886f70d010101')), der(0x05, new Uint8Array())));
const rsaSpki = der(0x30, concat(rsaAlgorithm, der(0x03, concat(Uint8Array.of(0), rawPoint))));
const wrongCurveAlgorithm = der(0x30, concat(der(0x06, hex('2a8648ce3d0201')), der(0x06, hex('2b81040022'))));
const wrongCurveSpki = der(0x30, concat(wrongCurveAlgorithm, der(0x03, concat(Uint8Array.of(0), rawPoint))));

describe('P-256 public-key normalization', () => {
    it('normalizes a raw uncompressed point', () => {
        expect(p256PublicKeyToJwk(base64(rawPoint))).toEqual({
            kty: 'EC',
            crv: 'P-256',
            x: 'axfR8uEsQkf4vOblY6RA8ncDfYEt6zOg9KE5RdiYwpY',
            y: 'T-NC4v4af5uO5-tKfA-eFivOM1drMV7Oy7ZAaDe_UfU',
        });
    });

    it('normalizes a P-256 SPKI to the same JWK', () => {
        expect(p256PublicKeyToJwk(base64(p256Spki))).toEqual(p256PublicKeyToJwk(base64(rawPoint)));
    });

    it('rejects a wrong curve SPKI', () => {
        expect(() => p256PublicKeyToJwk(base64(wrongCurveSpki))).toThrow('prime256v1');
    });

    it('rejects an RSA SPKI', () => {
        expect(() => p256PublicKeyToJwk(base64(rsaSpki))).toThrow('id-ecPublicKey');
    });

    it.each([
        Uint8Array.of(2, ...rawPoint.slice(1, 33)),
        rawPoint.slice(1),
        Uint8Array.of(5, ...rawPoint.slice(1)),
        Uint8Array.of(4, ...rawPoint.slice(1, 64)),
    ])('rejects malformed raw point %#', (point) => {
        expect(() => p256PublicKeyToJwk(base64(point))).toThrow();
    });

    it('rejects malformed DER and trailing bytes', () => {
        expect(() => p256PublicKeyToJwk(base64(Uint8Array.of(0x30, 0x01, 0x00)))).toThrow();
        expect(() => p256PublicKeyToJwk(base64(concat(p256Spki, Uint8Array.of(0))))).toThrow();
    });
});

describe('P-256 signature DER validation', () => {
    it('accepts two positive non-zero minimally encoded integers', () => {
        expect(() => validateP256DerSignature(hex('3006020101020101'))).not.toThrow();
    });

    it.each([
        '3003020101',
        '3009020101020101020101',
        '3006020180020101',
        '3006020100020101',
        '300702020001020101',
        '300602010102010100',
        '020101',
    ])('rejects malformed signature %s', (value) => {
        expect(() => validateP256DerSignature(hex(value))).toThrow();
    });
});

describe('enrollment public-key lookup', () => {
    beforeEach(() => {
        jest.mocked(getPublicKey).mockReset();
    });

    it('prefers the normalized package SPKI result', async () => {
        jest.mocked(getPublicKey).mockResolvedValue({ publicKey: base64(p256Spki), keyType: 'ec256' });

        await expect(getEnrollmentP256Jwk('alias', base64(rawPoint))).resolves.toEqual(
            p256PublicKeyToJwk(base64(rawPoint)),
        );
    });

    it('uses the creation-time point only for the documented authentication lookup failure', async () => {
        jest.mocked(getPublicKey).mockRejectedValue(
            Object.assign(new Error('Key requires user authentication'), { code: 'KEY_REQUIRES_AUTHENTICATION' }),
        );

        await expect(getEnrollmentP256Jwk('alias', base64(rawPoint))).resolves.toEqual(
            p256PublicKeyToJwk(base64(rawPoint)),
        );
    });

    it('does not hide unexpected lookup errors', async () => {
        const error = new Error('KEY_NOT_FOUND');
        jest.mocked(getPublicKey).mockRejectedValue(error);

        await expect(getEnrollmentP256Jwk('alias', base64(rawPoint))).rejects.toBe(error);
    });
});
