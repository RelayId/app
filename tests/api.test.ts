jest.mock('../src/relay/crypto', () => ({
    signMLDSA: jest.fn(async () => 'mldsa-signature'),
    signP256: jest.fn(async () => 'p256-signature'),
}));

jest.mock('react-native-quick-base64', () => ({
    fromByteArray: (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)),
    toByteArray: (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0)),
}));

jest.mock('react-native-quick-crypto', () => ({
    createHash: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn(() => new Uint8Array(64)),
    })),
    randomBytes: jest.fn(() => new Uint8Array(32)),
}));

import { getProviders } from '../src/relay/api';
import { beginEnrollment } from '../src/relay/api';
import { approveLogin } from '../src/relay/api';
import { generateCode } from '../src/relay/api';
import { denyLogin } from '../src/relay/api';
import { getLogin } from '../src/relay/api';
import type { Account } from '../src/relay/models';

const account: Account = {
    id: 'account',
    origin: 'https://relay.example.com',
    email: 'person@example.com',
    provider: 'google',
    deviceName: 'Phone',
    credential: 'rdc.credential',
    credentialExpiresAt: '2099-01-01T00:00:00Z',
    p256Alias: 'p256',
    mldsaSeedKey: 'mldsa',
};

function mockJSON(data: unknown, ok = true, status = 200): void {
    globalThis.fetch = jest.fn(async () => ({
        ok,
        status,
        headers: { get: () => 'application/json' },
        json: async () => ({ status, data }),
    })) as unknown as typeof fetch;
}

describe('Relay API contract', () => {
    afterEach(() => jest.restoreAllMocks());

    it('unwraps the provider list envelope', async () => {
        mockJSON({
            providers: [{ id: 'google', name: 'Google', provider: 'google', enabled: true }],
            mobile_code: { enabled: true, groups: 2 },
        });

        await expect(getProviders(account.origin)).resolves.toEqual({
            providers: [{ id: 'google', name: 'Google', provider: 'google', enabled: true }],
            mobileCode: { enabled: true, groups: 2 },
        });
    });

    it('sends provider_id when beginning enrollment', async () => {
        mockJSON({ authorization_url: 'https://accounts.example/authorize' });

        await beginEnrollment(account.origin, 'enrollment', 'google');

        const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0] as [URL, RequestInit];
        expect(init.body).toBe('{"provider_id":"google"}');
    });

    it('loads login details unsigned and uses the service login model', async () => {
        mockJSON({
            id: 'login',
            state: 'pending',
            client: { id: 'client', name: 'Example app' },
            scope: 'openid email profile',
            challenge: 'challenge',
            expires_at: '2099-01-01T00:00:00Z',
        });

        await expect(getLogin(account, 'login')).resolves.toMatchObject({
            client: { name: 'Example app' },
            scope: 'openid email profile',
            challenge: 'challenge',
        });
        const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0] as [URL, RequestInit];
        expect(init.body).toBeUndefined();
        expect(init.headers).toEqual({ Accept: 'application/json' });
    });

    it('sends the exact challenge for approve', async () => {
        mockJSON({ state: 'approved' });

        await approveLogin(account, 'login', 'exact-challenge');

        const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0] as [URL, RequestInit];
        expect(init.body).toBe('{"challenge":"exact-challenge"}');
    });

    it('sends the exact challenge for deny', async () => {
        mockJSON({ state: 'denied' });

        await denyLogin(account, 'login', 'exact-challenge');

        const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0] as [URL, RequestInit];
        expect(init.body).toBe('{"challenge":"exact-challenge"}');
    });

    it('sends exactly {} for code generation', async () => {
        mockJSON({ code: '123456', expires_at: '2099-01-01T00:00:00Z' });

        await generateCode(account);

        const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0] as [URL, RequestInit];
        expect(init.body).toBe('{}');
    });
});
