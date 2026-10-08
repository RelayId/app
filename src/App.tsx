import { authenticateWithOptions } from '@sbaiahmed1/react-native-biometrics';
import type { MobileCodeCapability, Provider } from './relay/models';
import { AnimatedPressable } from './components/AnimatedPressable';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeedbackModal } from './components/FeedbackModal';
import { removeLocalAccount } from './relay/keyLifecycle';
import { parseRelayConfigQR } from './relay/origin';
import { parseRelayLoginQR } from './relay/origin';
import { useAccounts } from './hooks/useAccounts';
import type { Account } from './relay/models';
import { Settings } from './screens/Settings';
import { saveAccount } from './relay/storage';
import { createCommonStyles } from './styles';
import { AddRelay } from './screens/AddRelay';
import { useTheme } from './hooks/useTheme';
import { Approve } from './screens/Approve';
import { getProviders } from './relay/api';
import { registerWatchCapability } from './relay/api';
import { publishRelayState } from './relay/wear';
import { StyleSheet } from 'react-native';
import { Enroll } from './screens/Enroll';
import { StatusBar } from 'react-native';
import { AppState } from 'react-native';
import { BackHandler } from 'react-native';
import type { ReactNode } from 'react';
import { userError } from './uiErrors';
import { Linking } from 'react-native';
import * as Device from 'expo-device';
import { Scan } from './screens/Scan';
import { Home } from './screens/Home';
import { Code } from './screens/Code';
import { View } from 'react-native';
import { Text } from 'react-native';
import { useEffect } from 'react';
import { useState } from 'react';
import { useRef } from 'react';

export type Screen =
    | { name: 'home' }
    | { name: 'add'; initialOrigin?: string; pendingLoginID?: string }
    | {
          name: 'enroll';
          origin: string;
          providers?: Provider[];
          mobileCode?: MobileCodeCapability;
          replacement?: Account;
          pendingLoginID?: string;
      }
    | { name: 'scan'; mode?: 'login' | 'relay'; relayOrigin?: string }
    | { name: 'approve'; id: string }
    | { name: 'code' }
    | { name: 'settings' };

export default function App() {
    const theme = useTheme();

    return (
        <SafeAreaProvider>
            <StatusBar
                barStyle={theme.text === '#fafafa' ? 'light-content' : 'dark-content'}
                backgroundColor={theme.background}
            />
            <AppContent />
        </SafeAreaProvider>
    );
}

export function AppContent() {
    const { accounts, loaded, selectedAccount, selectedAccountId, reloadAccounts, selectAccount } = useAccounts();
    const theme = useTheme();
    const [screen, setScreen] = useState<Screen>({ name: 'home' });
    const [feedback, setFeedback] = useState<{ title: string; message?: string }>();
    const [unlocked, setUnlocked] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState(false);
    const [unlockAttempt, setUnlockAttempt] = useState(0);
    const [reconcileAttempt, setReconcileAttempt] = useState(0);
    const [pendingLoginLink, setPendingLoginLink] = useState<{ origin: string; id: string }>();
    const reconcilingAccounts = useRef(false);
    const watchTokens = useRef(new Map<string, string>());
    const unlockedRef = useRef(false);
    const screenRef = useRef(screen);
    const deviceName = Device.deviceName || Device.modelName || 'Relay client';

    useEffect(() => {
        if (!loaded || !unlocked) return;

        let active = true;

        void Promise.all(
            accounts.map(async (account) => {
                if (!account.mobileCode?.enabled || watchTokens.current.has(account.id)) return;

                try {
                    const capability = await registerWatchCapability(account);
                    watchTokens.current.set(account.id, capability.token);
                } catch {
                    watchTokens.current.delete(account.id);
                }
            }),
        ).then(() => {
            if (active) publishRelayState(accounts, selectedAccount, undefined, undefined, watchTokens.current);
        });

        return () => {
            active = false;
        };
    }, [accounts, loaded, selectedAccount, unlocked]);

    useEffect(() => {
        unlockedRef.current = unlocked;
    }, [unlocked]);

    useEffect(() => {
        screenRef.current = screen;
    }, [screen]);

    useEffect(() => {
        if (!loaded || accounts.length === 0 || unlocked) return;

        setUnlocking(true);
        setUnlockError(false);
        let active = true;
        const timeout = setTimeout(() => {
            if (!active) return;

            setUnlocking(false);
            setUnlockError(true);
        }, 15000);

        void authenticateWithOptions({
            title: 'Unlock RelayId',
            subtitle: 'Your enrolled Relays stay private',
            description: 'Authenticate to view and use your Relay accounts.',
            allowDeviceCredentials: true,
            cancelLabel: 'Cancel',
        })
            .then((result) => {
                if (!active) return;

                if (result.success) setUnlocked(true);
                else setUnlockError(true);
            })
            .catch(() => {
                if (active) setUnlockError(true);
            })
            .finally(() => {
                clearTimeout(timeout);
                if (active) setUnlocking(false);
            });

        return () => {
            active = false;
            clearTimeout(timeout);
        };
    }, [accounts.length, loaded, unlockAttempt, unlocked]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                setReconcileAttempt((value) => value + 1);
                return;
            }

            if (screenRef.current.name === 'scan') return;

            if (unlockedRef.current) {
                unlockedRef.current = false;
                setUnlocked(false);
                setUnlocking(false);
                setUnlockError(false);
            }
        });

        return () => subscription.remove();
    }, []);

    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (!unlocked && accounts.length > 0) return true;

            switch (screen.name) {
                case 'home':
                    return false;
                case 'add':
                    setScreen({ name: 'home' });
                    return true;
                case 'enroll':
                    setScreen({ name: 'add', initialOrigin: screen.origin, pendingLoginID: screen.pendingLoginID });
                    return true;
                case 'scan':
                    setScreen(
                        screen.mode === 'relay' ? { name: 'add', initialOrigin: screen.relayOrigin } : { name: 'home' },
                    );
                    return true;
                case 'approve':
                case 'code':
                case 'settings':
                    setScreen({ name: 'home' });
                    return true;
            }
        });

        return () => subscription.remove();
    }, [accounts.length, screen, unlocked]);

    useEffect(() => {
        if (!loaded || !unlocked || accounts.length === 0 || reconcilingAccounts.current) return;

        reconcilingAccounts.current = true;
        void (async () => {
            let removed = 0;
            let capabilityUpdates = 0;
            let failed = 0;

            for (const account of accounts) {
                let shouldRemove = false;
                let capabilityChanged = false;
                let mobileCode = account.mobileCode;

                try {
                    const discovery = await getProviders(account.origin);
                    const linked = discovery.providers.find((provider) => provider.id === account.provider);
                    shouldRemove = discovery.providers.length === 0 || !linked || linked.enabled === false;
                    mobileCode = discovery.mobileCode;
                    capabilityChanged =
                        account.mobileCode?.enabled !== discovery.mobileCode.enabled ||
                        account.mobileCode?.groups !== discovery.mobileCode.groups;
                } catch {
                    continue;
                }

                if (shouldRemove) {
                    try {
                        await removeLocalAccount(account);
                        removed += 1;
                    } catch {
                        failed += 1;
                    }
                    continue;
                }

                try {
                    if (capabilityChanged) {
                        await saveAccount({ ...account, mobileCode });
                        capabilityUpdates += 1;
                    }
                } catch {
                    failed += 1;
                }
            }

            if (removed > 0 || capabilityUpdates > 0) {
                await reloadAccounts();
            }

            if (removed > 0) {
                setFeedback({
                    title: 'Relay removed',
                    message: 'Its linked provider is no longer available, so the local account and keys were removed.',
                });
            }

            if (failed > 0) {
                setFeedback({
                    title: 'Relay refresh incomplete',
                    message:
                        'A Relay setting changed, but secure local account refresh failed. Keep RelayId open and try again.',
                });
            }
        })().finally(() => {
            reconcilingAccounts.current = false;
        });
    }, [accounts, loaded, reconcileAttempt, reloadAccounts, unlocked]);

    useEffect(() => {
        const openRelayLink = (value: string | null) => {
            if (!value) return;

            try {
                if (value.startsWith('relayid://relay')) {
                    setScreen({ name: 'add', initialOrigin: parseRelayConfigQR(value, __DEV__) });
                    return;
                }

                if (value.startsWith('relayid://login')) {
                    setPendingLoginLink(parseRelayLoginQR(value, __DEV__));
                }
            } catch {
                setFeedback({
                    title: 'Relay link rejected',
                    message: 'The link does not contain a valid Relay address.',
                });
            }
        };

        void Linking.getInitialURL().then(openRelayLink);
        const subscription = Linking.addEventListener('url', ({ url }) => openRelayLink(url));
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (!pendingLoginLink || !loaded || (accounts.length > 0 && !unlocked)) return;

        const account = accounts.find((candidate) => candidate.origin === pendingLoginLink.origin);
        setPendingLoginLink(undefined);
        if (account) {
            selectAccount(account.id);
            setScreen({ name: 'approve', id: pendingLoginLink.id });
            return;
        }

        setScreen({ name: 'add', initialOrigin: pendingLoginLink.origin, pendingLoginID: pendingLoginLink.id });
    }, [accounts, loaded, pendingLoginLink, selectAccount, unlocked]);

    function home(): void {
        setScreen({ name: 'home' });
    }

    async function openProtectedAction(action: 'scan' | 'code'): Promise<void> {
        if (!selectedAccount) {
            setFeedback({
                title: 'Add a Relay first',
                message:
                    action === 'scan'
                        ? 'Add a Relay server before scanning a login.'
                        : 'Add a Relay server before generating a code.',
            });
            return;
        }

        if (new Date(selectedAccount.credentialExpiresAt).getTime() <= Date.now()) {
            setFeedback({
                title: 'Credential expired',
                message:
                    action === 'scan'
                        ? 'Re-enroll this Relay account before scanning a login.'
                        : 'Re-enroll this Relay account before generating a code.',
            });
            return;
        }

        try {
            const discovery = await getProviders(selectedAccount.origin);
            const provider = discovery.providers.find((candidate) => candidate.id === selectedAccount.provider);
            if (!provider || provider.enabled === false) {
                try {
                    await removeLocalAccount(selectedAccount);
                    await reloadAccounts();
                    setFeedback({
                        title: 'Relay removed',
                        message:
                            'Its linked provider is no longer available, so the local account and keys were removed.',
                    });
                } catch {
                    setFeedback({
                        title: 'Relay cleanup incomplete',
                        message:
                            'The linked provider is no longer available, but secure local cleanup failed. Try again from Settings.',
                    });
                }
                return;
            }
        } catch (error) {
            setFeedback({ title: 'Could not check Relay', message: userError(error, 'Try again.') });
            return;
        }

        if (action === 'scan') setScreen({ name: 'scan' });
        else setScreen({ name: 'code' });
    }

    if (loaded && accounts.length > 0 && !unlocked) {
        const common = createCommonStyles(theme);

        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', padding: 24 }}>
                <Text style={common.title}>Unlock RelayId</Text>
                <Text style={[common.muted, { marginTop: 12 }]}>Authenticate to view your enrolled Relays.</Text>
                {unlockError ? (
                    <Text style={{ color: theme.danger, fontSize: 15, lineHeight: 22, marginTop: 16 }}>
                        Unlock was cancelled or failed. Try again.
                    </Text>
                ) : null}
                <AnimatedPressable
                    style={[common.primary, { marginTop: 24 }]}
                    onPress={() => {
                        setUnlockError(false);
                        setUnlockAttempt((value) => value + 1);
                    }}
                >
                    <Text style={common.primaryText}>{unlocking ? 'Waiting for authentication..' : 'Unlock'}</Text>
                </AnimatedPressable>
                <AppHash />
            </SafeAreaView>
        );
    }

    function renderScreen(): ReactNode {
        switch (screen.name) {
            case 'add':
                return (
                    <AddRelay
                        existingOrigins={accounts.map((account) => account.origin)}
                        initialOrigin={screen.initialOrigin}
                        onBack={home}
                        onScan={(origin) => setScreen({ name: 'scan', mode: 'relay', relayOrigin: origin })}
                        onNext={(origin, providers, mobileCode) =>
                            setScreen({
                                name: 'enroll',
                                origin,
                                providers,
                                mobileCode,
                                pendingLoginID: screen.pendingLoginID,
                            })
                        }
                    />
                );

            case 'enroll':
                return (
                    <Enroll
                        origin={screen.origin}
                        deviceName={deviceName}
                        providers={screen.providers}
                        mobileCode={screen.mobileCode}
                        replacement={screen.replacement}
                        onBack={home}
                        onComplete={async () => {
                            const refreshed = await reloadAccounts();
                            const enrolled = screen.pendingLoginID
                                ? refreshed.find((account) => account.origin === screen.origin)
                                : undefined;
                            if (enrolled && screen.pendingLoginID) {
                                selectAccount(enrolled.id);
                                setScreen({ name: 'approve', id: screen.pendingLoginID });
                            } else {
                                home();
                            }
                        }}
                    />
                );

            case 'scan':
                return (
                    <Scan
                        account={selectedAccount}
                        mode={screen.mode}
                        onBack={() =>
                            screen.mode === 'relay'
                                ? setScreen({ name: 'add', initialOrigin: screen.relayOrigin })
                                : home()
                        }
                        onLogin={(id) => setScreen({ name: 'approve', id })}
                        onRelay={(origin) => setScreen({ name: 'add', initialOrigin: origin })}
                    />
                );

            case 'approve':
                return selectedAccount ? <Approve account={selectedAccount} id={screen.id} onBack={home} /> : null;

            case 'code':
                return selectedAccount ? <Code account={selectedAccount} onBack={home} /> : null;

            case 'settings':
                return (
                    <Settings
                        accounts={accounts}
                        onBack={home}
                        onDeleted={async () => {
                            await reloadAccounts();
                        }}
                        onReenroll={(account) =>
                            setScreen({ name: 'enroll', origin: account.origin, replacement: account })
                        }
                    />
                );

            case 'home': {
                return (
                    <Home
                        accounts={accounts}
                        selectedAccountId={selectedAccountId}
                        onSelect={selectAccount}
                        onAdd={() => setScreen({ name: 'add' })}
                        onScan={() => void openProtectedAction('scan')}
                        onCode={() => void openProtectedAction('code')}
                        mobileCode={selectedAccount?.mobileCode}
                        onSettings={() => setScreen({ name: 'settings' })}
                    />
                );
            }
        }
    }

    return (
        <View style={styles.shell}>
            {renderScreen()}
            <AppHash />
            <FeedbackModal
                visible={feedback !== undefined}
                title={feedback?.title ?? ''}
                message={feedback?.message}
                actions={[{ label: 'Close', onPress: () => setFeedback(undefined) }]}
            />
        </View>
    );
}

function AppHash() {
    const theme = useTheme();
    const hash = (process.env.EXPO_PUBLIC_APP_HASH?.trim() || '7f3c9a21').slice(0, 12);
    const styles = StyleSheet.create({
        container: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 24,
            alignItems: 'center',
        },
        text: { color: theme.muted, fontSize: 10, opacity: 0.55, letterSpacing: 0.4 },
    });

    return (
        <View pointerEvents="none" style={styles.container}>
            <Text style={styles.text}>{hash}</Text>
        </View>
    );
}

const styles = StyleSheet.create({ shell: { flex: 1 } });
