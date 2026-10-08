export type P256Jwk = {
    kty: 'EC';
    crv: 'P-256';
    x: string;
    y: string;
};

export type Account = {
    id: string;
    origin: string;
    email: string;
    provider: string;
    deviceName: string;
    credential: string;
    credentialExpiresAt: string;
    p256Alias: string;
    mldsaSeedKey: string;
    mobileCode?: MobileCodeCapability;
};

export type Provider = { id: string; name: string; provider: string; enabled: boolean };

export type MobileCodeCapability = {
    enabled: boolean;
    groups: number;
};

export type WatchCapability = {
    token: string;
    expires_at: string;
};

export type ProviderDiscovery = {
    providers: Provider[];
    mobileCode: MobileCodeCapability;
};

export type Envelope<T> = { status: number; data: T } | { status: number; error: string };

export type EnrollmentCreated = {
    id: string;
    state: 'pending';
    authorization_url?: string;
    expires_at: string;
};

export type EnrollmentStatus = {
    id: string;
    state: 'pending' | 'verified' | 'expired' | 'complete';
    expires_at: string;
    email?: string;
    signing_payload?: string;
};

export type EnrollmentComplete = {
    id: string;
    state: 'complete';
    credential: string;
    email: string;
    provider_id: string;
    device_name: string;
    expires_at: string;
};

export type Login = {
    id: string;
    state: 'pending' | 'approved' | 'denied' | 'expired';
    client: { id: string; name: string };
    scope: string;
    challenge: string;
    expires_at: string;
};
