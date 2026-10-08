jest.mock('react-native-quick-base64', () => ({
    fromByteArray: (bytes: Uint8Array, urlSafe = false) => {
        const value = btoa(String.fromCharCode(...bytes));
        return urlSafe ? value.replace(/\+/gu, '-').replace(/\//gu, '_') : value;
    },
    toByteArray: (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0)),
}));

jest.mock('react-native-quick-crypto', () => ({
    randomBytes: jest.fn(() => new Uint8Array(24)),
}));

import { decodeBase64Url } from '../src/relay/base64';
import { encodeBase64Url } from '../src/relay/base64';
import { decodeBase64 } from '../src/relay/base64';
import { encodeBase64 } from '../src/relay/base64';
import { randomBytes } from '../src/relay/base64';

describe('base64 helpers', () => {
    it('keeps standard Base64 distinct from base64url', () => {
        const bytes = Uint8Array.from([251, 239, 255]);

        expect(encodeBase64(bytes)).toBe('++//');
        expect(encodeBase64Url(bytes)).toBe('--__');
        expect(decodeBase64('++//')).toEqual(bytes);
        expect(decodeBase64Url('--__')).toEqual(bytes);
    });

    it('uses 24 native random bytes and emits 32 unpadded URL characters', () => {
        const value = encodeBase64Url(randomBytes(24));

        expect(value).toHaveLength(32);
        expect(value).not.toContain('=');
    });
});
