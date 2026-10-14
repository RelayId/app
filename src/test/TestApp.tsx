import type { Account, Provider } from '../relay/models';
import { Approve } from './screens/Approve';
import { Code } from './screens/Code';
import { AddRelay } from './screens/AddRelay';
import { Enroll } from './screens/Enroll';
import { Home } from './screens/Home';
import { Scan } from './screens/Scan';
import { Settings } from './screens/Settings';
import { useState } from 'react';

const testOrigin = process.env.EXPO_PUBLIC_TEST_RELAY_ORIGIN?.trim().replace(/\/+$/u, '') || 'https://relay.example.com';

const testAccount: Account = {
    id: 'test-account',
    origin: testOrigin,
    email: 'demo@example.com',
    provider: 'demo',
    deviceName: 'RelayId test device',
    credential: 'test-credential',
    credentialExpiresAt: '2099-01-01T00:00:00.000Z',
    p256Alias: 'test-p256',
    mldsaSeedKey: 'test-mldsa',
    mobileCode: { enabled: true, groups: 3 },
};

const testProviders: Provider[] = [
    { id: 'demo', name: 'Demo identity provider', provider: 'demo', enabled: true },
    { id: 'disabled', name: 'Unavailable provider', provider: 'disabled', enabled: false },
];

type TestScreen =
    | { name: 'home' }
    | { name: 'add'; origin?: string }
    | { name: 'enroll'; origin: string }
    | { name: 'scan'; mode?: 'login' | 'relay'; origin?: string }
    | { name: 'approve' }
    | { name: 'code' }
    | { name: 'settings' };

export function TestApp({ onExitTap }: { onExitTap: () => void }) {
    const [screen, setScreen] = useState<TestScreen>({ name: 'home' });

    switch (screen.name) {
        case 'home':
            return (
                <Home
                    accounts={[testAccount]}
                    selectedAccountId={testAccount.id}
                    onSelect={() => undefined}
                    onAdd={() => setScreen({ name: 'add' })}
                    onScan={() => setScreen({ name: 'scan' })}
                    onCode={() => setScreen({ name: 'code' })}
                    mobileCode={testAccount.mobileCode}
                    onSettings={() => setScreen({ name: 'settings' })}
                    onSecretTap={onExitTap}
                />
            );

        case 'add':
            return (
                <AddRelay
                    existingAccounts={[]}
                    initialOrigin={screen.origin ?? 'https://relay.example.com'}
                    onBack={() => setScreen({ name: 'home' })}
                    onScan={(origin) => setScreen({ name: 'scan', mode: 'relay', origin })}
                    onNext={(origin) => setScreen({ name: 'enroll', origin })}
                />
            );

        case 'enroll':
            return (
                <Enroll
                    origin={screen.origin}
                    deviceName={testAccount.deviceName}
                    providers={testProviders}
                    mobileCode={testAccount.mobileCode}
                    onBack={() => setScreen({ name: 'add', origin: screen.origin })}
                    onComplete={() => setScreen({ name: 'home' })}
                />
            );

        case 'scan':
            return (
                <Scan
                    account={testAccount}
                    mode={screen.mode}
                    onBack={() => setScreen({ name: 'home' })}
                    onLogin={() => setScreen({ name: 'approve' })}
                    onRelay={(origin) => setScreen({ name: 'add', origin })}
                />
            );

        case 'approve':
            return <Approve account={testAccount} id="test-login" onBack={() => setScreen({ name: 'home' })} />;

        case 'code':
            return <Code account={testAccount} onBack={() => setScreen({ name: 'home' })} />;

        case 'settings':
            return (
                <Settings
                    accounts={[testAccount]}
                    onBack={() => setScreen({ name: 'home' })}
                    onDeleted={async () => undefined}
                    onReenroll={() => setScreen({ name: 'enroll', origin: testAccount.origin })}
                />
            );
    }
}
