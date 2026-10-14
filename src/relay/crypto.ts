import { sign } from '@sbaiahmed1/react-native-biometrics';
import { SignatureAlgorithm } from '@sbaiahmed1/react-native-biometrics';
import { signWithOptions } from '@sbaiahmed1/react-native-biometrics';
import { InputEncoding } from '@sbaiahmed1/react-native-biometrics';
import { getPublicKey } from '@sbaiahmed1/react-native-biometrics';
import type { CryptoKey } from 'react-native-quick-crypto';
import { toByteArray } from 'react-native-quick-base64';
import { subtle } from 'react-native-quick-crypto';
import { encodeBase64Url } from './base64';
import { decodeBase64Url } from './base64';
import { ObjectIdentifier } from 'asn1js';
import { encodeBase64 } from './base64';
import { decodeBase64 } from './base64';
import { readSecret } from './storage';
import { BitString } from 'asn1js';
import { Sequence } from 'asn1js';
import { Integer } from 'asn1js';
import { fromBER } from 'asn1js';

const mlDsaName = 'ML-DSA-65' as const;

export async function importMLDSASeed(seed: Uint8Array): Promise<CryptoKey> {
    if (seed.length !== 32) throw new Error('ML-DSA seed must be 32 bytes');
    return subtle.importKey('raw-seed', seed, { name: mlDsaName }, false, ['sign']);
}

export async function deriveMLDSAPublicKey(seed: Uint8Array): Promise<Uint8Array> {
    const privateKey = await importMLDSASeed(seed);
    const publicKey = await subtle.getPublicKey(privateKey, ['verify']);

    const exported = await subtle.exportKey('raw-public', publicKey);
    if (exported instanceof ArrayBuffer) return new Uint8Array(exported);
    throw new Error('Unexpected ML-DSA public-key export format');
}

export async function signMLDSA(seedKey: string, message: Uint8Array): Promise<string> {
    const encodedSeed = await readSecret(seedKey);
    if (!encodedSeed) throw new Error('ML-DSA seed is unavailable');

    const privateKey = await importMLDSASeed(decodeSeed(encodedSeed));
    const signature = await subtle.sign({ name: mlDsaName }, privateKey, message);

    return encodeBase64Url(new Uint8Array(signature));
}

export async function signP256(
    alias: string,
    message: Uint8Array,
    prompt: string,
    requireAuthentication = true,
): Promise<string> {
    const result = requireAuthentication
        ? await signWithOptions({
              keyAlias: alias,
              data: encodeBase64(message),
              inputEncoding: InputEncoding.Base64,
              promptTitle: prompt,
          })
        : await sign({
              keyAlias: alias,
              data: encodeBase64(message),
              inputEncoding: InputEncoding.Base64,
              algorithm: SignatureAlgorithm.SHA256withECDSA,
          });

    if (!result.success || !result.signature) {
        if (!requireAuthentication && result.errorCode === 'KEY_REQUIRES_AUTHENTICATION') {
            throw new Error('Re-enroll this Relay account to generate codes without device authentication.');
        }
        throw new Error('P-256 signing was cancelled or failed');
    }

    const signature = decodeBase64(result.signature);
    validateP256DerSignature(signature);

    return encodeBase64Url(signature);
}

export function decodeSeed(value: string): Uint8Array {
    return decodeBase64Url(value);
}

export function p256PointToJwk(point: Uint8Array): { kty: 'EC'; crv: 'P-256'; x: string; y: string } {
    if (point.length !== 65 || point[0] !== 0x04) throw new Error('Expected uncompressed P-256 public key');
    return { kty: 'EC', crv: 'P-256', x: encodeBase64Url(point.slice(1, 33)), y: encodeBase64Url(point.slice(33, 65)) };
}

export function validateDerInteger(integer: Integer, label: string) {
    const bytes = new Uint8Array(integer.valueBlock.valueHexView);

    if (bytes.length === 0) throw new Error(`${label} is empty`);
    const first = bytes[0] as number;
    if ((first & 0x80) !== 0) throw new Error(`${label} is negative`);
    if (bytes.length === 1 && first === 0) throw new Error(`${label} is zero`);
    if (first === 0 && bytes.length > 1 && ((bytes[1] as number) & 0x80) === 0)
        throw new Error(`${label} is not minimally encoded`);
}

export function validateP256DerSignature(bytes: Uint8Array) {
    const parsed = fromBER(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

    if (parsed.offset !== bytes.byteLength || !(parsed.result instanceof Sequence))
        throw new Error('P-256 signature was not a complete ASN.1 DER sequence');
    if (parsed.result.valueBlock.value.length !== 2)
        throw new Error('P-256 signature must contain exactly two integers');

    const [r, s] = parsed.result.valueBlock.value;
    if (!(r instanceof Integer) || !(s instanceof Integer))
        throw new Error('P-256 signature must contain two integers');

    validateDerInteger(r, 'P-256 signature r');
    validateDerInteger(s, 'P-256 signature s');
}

export function p256PublicKeyToJwk(publicKeyBase64: string): { kty: 'EC'; crv: 'P-256'; x: string; y: string } {
    const der = toByteArray(publicKeyBase64);

    if (der.length === 65 && der[0] === 0x04) return p256PointToJwk(der);

    const parsed = fromBER(der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength) as ArrayBuffer);
    if (parsed.offset !== der.byteLength || !(parsed.result instanceof Sequence))
        throw new Error('Invalid P-256 public key');
    if (parsed.result.valueBlock.value.length !== 2) throw new Error('Invalid P-256 SubjectPublicKeyInfo');

    const algorithm = parsed.result.valueBlock.value[0];
    const bitString = parsed.result.valueBlock.value[1];
    if (!(algorithm instanceof Sequence) || algorithm.valueBlock.value.length !== 2)
        throw new Error('Invalid P-256 algorithm identifier');

    const algorithmOid = algorithm.valueBlock.value[0];
    const curveOid = algorithm.valueBlock.value[1];
    if (!(algorithmOid instanceof ObjectIdentifier) || algorithmOid.valueBlock.toString() !== '1.2.840.10045.2.1')
        throw new Error('P-256 key does not use id-ecPublicKey');
    if (!(curveOid instanceof ObjectIdentifier) || curveOid.valueBlock.toString() !== '1.2.840.10045.3.1.7')
        throw new Error('P-256 key does not use prime256v1');

    if (!(bitString instanceof BitString)) throw new Error('Invalid P-256 public key bit string');
    if (bitString.valueBlock.unusedBits !== 0) throw new Error('Invalid P-256 public key bit string');

    return p256PointToJwk(new Uint8Array(bitString.valueBlock.valueHexView));
}

function isAuthenticationLookupError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'KEY_REQUIRES_AUTHENTICATION')
        return true;
    return error instanceof Error && error.message.includes('KEY_REQUIRES_AUTHENTICATION');
}

export async function getEnrollmentP256Jwk(
    alias: string,
    creationPublicKey: string,
): Promise<{ kty: 'EC'; crv: 'P-256'; x: string; y: string }> {
    try {
        const normalized = await getPublicKey(alias);
        if (normalized.keyType && normalized.keyType !== 'ec256') throw new Error('Enrollment key is not EC256');
        return p256PublicKeyToJwk(normalized.publicKey);
    } catch (error) {
        if (!isAuthenticationLookupError(error)) throw error;
        return p256PublicKeyToJwk(creationPublicKey);
    }
}
