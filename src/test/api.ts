import type {
    Account,
    EnrollmentComplete,
    EnrollmentCreated,
    EnrollmentStatus,
    Login,
    ProviderDiscovery,
} from '../relay/models';

const expiresAt = new Date(Date.now() + 60_000).toISOString();
const exampleOrigin = 'https://relay.example.com';

const providers = [
    { id: 'demo', name: 'Demo identity provider', provider: 'demo', enabled: true },
    { id: 'disabled', name: 'Unavailable provider', provider: 'disabled', enabled: false },
];

function remoteOrigin(origin: string): string | undefined {
    const value = origin.trim().replace(/\/+$/u, '');
    return value && value !== exampleOrigin ? value : undefined;
}

async function remote<T>(origin: string, path: string, init?: RequestInit): Promise<T> {
    const base = remoteOrigin(origin);
    if (!base) throw new Error('Remote test Relay is not configured');

    const response = await fetch(`${base}${path}`, {
        ...init,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
    });
    const body = (await response.json()) as { data?: T; error?: string };
    if (!response.ok || !body.data) throw new Error(body.error || `Test Relay request failed (${response.status})`);
    return body.data;
}

export async function getProviders(_origin: string): Promise<ProviderDiscovery> {
    if (remoteOrigin(_origin)) {
        const data = await remote<{
            providers: ProviderDiscovery['providers'];
            mobile_code: ProviderDiscovery['mobileCode'];
        }>(_origin, '/oidc/demo/providers');
        return { providers: data.providers, mobileCode: data.mobile_code };
    }

    return Promise.resolve({ providers, mobileCode: { enabled: true, groups: 2 } });
}

export async function getLogin(_account: Account, id: string): Promise<Login> {
    if (remoteOrigin(_account.origin)) return remote<Login>(_account.origin, `/oidc/demo/logins/${encodeURIComponent(id)}`);

    return Promise.resolve({
        id,
        state: 'pending',
        client: { id: 'test-client', name: 'RelayId demo browser' },
        scope: 'openid profile email',
        challenge: 'test-challenge',
        expires_at: expiresAt,
    });
}

export async function approveLogin(_account: Account, _id: string, _challenge: string): Promise<void> {
    if (remoteOrigin(_account.origin)) {
        await remote(_account.origin, `/oidc/demo/logins/${encodeURIComponent(_id)}/approve`, { method: 'POST', body: '{}' });
        return;
    }

    return Promise.resolve();
}

export async function denyLogin(_account: Account, _id: string, _challenge: string): Promise<void> {
    if (remoteOrigin(_account.origin)) {
        await remote(_account.origin, `/oidc/demo/logins/${encodeURIComponent(_id)}/deny`, { method: 'POST', body: '{}' });
        return;
    }

    return Promise.resolve();
}

export async function generateCode(_account: Account): Promise<{ code: string; expires_at: string }> {
    if (remoteOrigin(_account.origin)) return remote(_account.origin, '/oidc/demo/codes', { method: 'POST', body: '{}' });

    return Promise.resolve({ code: '1234-5678', expires_at: new Date(Date.now() + 60_000).toISOString() });
}

export function createEnrollment(
    _origin: string,
    _deviceName: string,
    _keys: unknown,
    _returnUri: string,
): Promise<EnrollmentCreated> {
    return Promise.resolve({ id: 'test-enrollment', state: 'pending', expires_at: expiresAt });
}

export function beginEnrollment(
    _origin: string,
    _id: string,
    _providerId: string,
): Promise<{ authorization_url: string }> {
    return Promise.resolve({ authorization_url: 'https://relay.example.com/test/authorization' });
}

export function getEnrollment(_origin: string, id: string): Promise<EnrollmentStatus> {
    return Promise.resolve({ id, state: 'verified', expires_at: expiresAt, signing_payload: 'test-payload' });
}

export function completeEnrollment(
    _origin: string,
    id: string,
    _signatures: { p256: string; mldsa65: string },
): Promise<EnrollmentComplete> {
    return Promise.resolve({
        id,
        state: 'complete',
        credential: 'test-credential',
        email: 'demo@example.com',
        provider_id: 'demo',
        device_name: 'RelayId test device',
        expires_at: '2099-01-01T00:00:00.000Z',
    });
}
