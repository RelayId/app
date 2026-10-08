import { randomBytes as nativeRandomBytes } from 'react-native-quick-crypto';
import { fromByteArray } from 'react-native-quick-base64';
import { toByteArray } from 'react-native-quick-base64';

export function encodeBase64(bytes: Uint8Array): string {
    return fromByteArray(bytes);
}

export function encodeBase64Url(bytes: Uint8Array): string {
    return fromByteArray(bytes, true).replace(/=+$/u, '');
}

export function decodeBase64Url(value: string): Uint8Array {
    const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return toByteArray(padded);
}

export function decodeBase64(value: string): Uint8Array {
    return toByteArray(value);
}

export function randomBytes(size: number): Uint8Array {
    return new Uint8Array(nativeRandomBytes(size));
}
