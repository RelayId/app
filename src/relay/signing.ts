import { createHash } from 'react-native-quick-crypto';
import { encodeBase64Url } from './base64';

export function jsonBytes(value: unknown): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(value));
}

export async function canonicalRequest(
    method: string,
    path: string,
    timestamp: string,
    nonce: string,
    body: Uint8Array,
): Promise<Uint8Array> {
    if (path.includes('?')) throw new Error('Signed paths cannot contain a query string');
    const digest = createHash('sha512').update(body).digest();
    const digestB64 = encodeBase64Url(new Uint8Array(digest));
    return new TextEncoder().encode(
        ['relay-device-request', method.toUpperCase(), path, timestamp, nonce, digestB64].join('\n'),
    );
}

export function utf8Body(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
}
