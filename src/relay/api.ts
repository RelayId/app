import { canonicalRequest, jsonBytes, utf8Body } from './signing';
import { encodeBase64Url, randomBytes } from './base64';
import type { EnrollmentComplete } from './models';
import type { EnrollmentCreated } from './models';
import type { EnrollmentStatus } from './models';
import { signMLDSA, signP256 } from './crypto';
import type { Provider } from './models';
import type { ProviderDiscovery } from './models';
import type { Envelope } from './models';
import type { Account } from './models';
import type { Login } from './models';
import type { WatchCapability } from './models';

export type ApiError = { status: number; error: string };

export function isApiError<T>(body: Envelope<T>): body is ApiError {
    return 'error' in body;
}

async function request<T>(url: URL, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
        const response = await fetch(url, {
            ...init,
            redirect: 'error',
            signal: controller.signal,
            headers: { Accept: 'application/json', ...init.headers },
        });

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
            throw new Error(`Relay returned ${response.status} without JSON`);
        }

        const body = (await response.json()) as Envelope<T>;
        if (!response.ok || isApiError(body)) {
            throw new Error((isApiError(body) && body.error) || `Relay request failed (${response.status})`);
        }

        return body.data;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Relay request timed out');
        }

        throw error;
    } finally {
        clearTimeout(timer);
    }
}

export function getProviders(origin: string): Promise<ProviderDiscovery> {
    return request<{ providers: Provider[]; mobile_code: { enabled: boolean; groups: number } }>(
        new URL('/api/providers', origin),
        {
            method: 'GET',
        },
    ).then((data) => ({
        providers: data.providers,
        mobileCode: {
            enabled: data.mobile_code.enabled,
            groups: data.mobile_code.groups,
        },
    }));
}

export function createEnrollment(
    origin: string,
    deviceName: string,
    keys: unknown,
    returnUri: string,
): Promise<EnrollmentCreated> {
    return request(new URL('/api/enrollments', origin), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: utf8Body(jsonBytes({ device_name: deviceName, keys, return_uri: returnUri })),
    });
}

export function beginEnrollment(
    origin: string,
    id: string,
    providerID: string,
): Promise<{ authorization_url: string }> {
    return request(new URL(`/api/enrollments/${encodeURIComponent(id)}/oauth2`, origin), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: utf8Body(jsonBytes({ provider_id: providerID })),
    });
}

export function getEnrollment(origin: string, id: string): Promise<EnrollmentStatus> {
    return request(new URL(`/api/enrollments/${encodeURIComponent(id)}`, origin), { method: 'GET' });
}

export function completeEnrollment(
    origin: string,
    id: string,
    signatures: { p256: string; mldsa65: string },
): Promise<EnrollmentComplete> {
    return request(new URL(`/api/enrollments/${encodeURIComponent(id)}/complete`, origin), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: utf8Body(jsonBytes({ signatures })),
    });
}

export async function signedRequest<T>(
    account: Account,
    method: string,
    path: string,
    body: Uint8Array,
    prompt = 'Approve Relay request',
): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = encodeBase64Url(randomBytes(24));
    const canonical = await canonicalRequest(method, path, timestamp, nonce, body);
    const p256 = await signP256(account.p256Alias, canonical, prompt);
    const mldsa65 = await signMLDSA(account.mldsaSeedKey, canonical);

    return request(new URL(path, account.origin), {
        method,
        body: utf8Body(body),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `RelayDevice ${account.credential}`,
            'X-Relay-Timestamp': timestamp,
            'X-Relay-Nonce': nonce,
            'X-Relay-P256-Signature': p256,
            'X-Relay-MLDSA65-Signature': mldsa65,
        },
    });
}

export function getLogin(account: Account, id: string): Promise<Login> {
    return request(new URL(`/api/logins/${encodeURIComponent(id)}`, account.origin), { method: 'GET' });
}

export function approveLogin(account: Account, id: string, challenge: string): Promise<unknown> {
    return signedRequest(
        account,
        'POST',
        `/api/logins/${encodeURIComponent(id)}/approve`,
        jsonBytes({ challenge }),
        'Approve sign-in',
    );
}

export function denyLogin(account: Account, id: string, challenge: string): Promise<unknown> {
    return signedRequest(
        account,
        'POST',
        `/api/logins/${encodeURIComponent(id)}/deny`,
        jsonBytes({ challenge }),
        'Deny sign-in',
    );
}

export function generateCode(account: Account): Promise<{ code: string; expires_at: string }> {
    return signedRequest(account, 'POST', '/api/codes', jsonBytes({}), 'Generate Relay code');
}

export function registerWatchCapability(account: Account): Promise<WatchCapability> {
    return request(new URL('/api/watch', account.origin), {
        method: 'POST',
        body: utf8Body(jsonBytes({})),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `RelayDevice ${account.credential}`,
        },
    });
}
