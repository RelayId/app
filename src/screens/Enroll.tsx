import type { Account, MobileCodeCapability, Provider } from '../relay/models';
import { createKeysWithOptions } from '@sbaiahmed1/react-native-biometrics';
import { assertDeviceSecurityAvailable } from '../relay/keyLifecycle';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { cleanupUnpersistedKeys } from '../relay/keyLifecycle';
import { validateEnrollmentReturnURL } from '../relay/origin';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeedbackModal } from '../components/FeedbackModal';
import { removeLocalAccount } from '../relay/keyLifecycle';
import { getEnrollmentP256Jwk } from '../relay/crypto';
import { deriveMLDSAPublicKey } from '../relay/crypto';
import { ChevronRight } from 'lucide-react-native';
import { encodeBase64Url } from '../relay/base64';
import { completeEnrollment } from '../relay/api';
import { createEnrollment } from '../relay/api';
import * as WebBrowser from 'expo-web-browser';
import { saveAccount } from '../relay/storage';
import { createCommonStyles } from '../styles';
import { beginEnrollment } from '../relay/api';
import { saveSecret } from '../relay/storage';
import { randomBytes } from '../relay/base64';
import { useTheme } from '../hooks/useTheme';
import { getEnrollment } from '../relay/api';
import { signMLDSA } from '../relay/crypto';
import { getProviders } from '../relay/api';
import { signP256 } from '../relay/crypto';
import { StyleSheet } from 'react-native';
import { userError } from '../uiErrors';
import { View } from 'react-native';
import { Text } from 'react-native';
import { useEffect } from 'react';
import { useState } from 'react';

export type EnrollProps = {
    origin: string;
    deviceName: string;
    providers?: Provider[];
    mobileCode?: MobileCodeCapability;
    replacement?: Account;
    onBack: () => void;
    onComplete: () => void | Promise<void>;
};

export function Enroll({
    origin,
    deviceName,
    providers,
    mobileCode = { enabled: false, groups: 3 },
    replacement,
    onBack,
    onComplete,
}: EnrollProps) {
    const [loadedProviders, setLoadedProviders] = useState<Provider[]>(providers ?? []);
    const [codeCapability, setCodeCapability] = useState(mobileCode);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<{ title: string; message?: string }>();
    const theme = useTheme();
    const styles = createStyles(theme);

    useEffect(() => {
        if (providers) return;

        void getProviders(origin)
            .then((discovery) => {
                setLoadedProviders(discovery.providers);
                setCodeCapability(discovery.mobileCode);
            })
            .catch((error) =>
                setFeedback({ title: 'Could not load providers', message: userError(error, 'Try again.') }),
            );
    }, [origin, providers]);

    async function waitForVerification(id: string, expiresAt: string) {
        const deadline = new Date(expiresAt).getTime();

        while (Date.now() < deadline) {
            const status = await getEnrollment(origin, id);
            if (status.state === 'verified' && status.signing_payload) return status;
            if (status.state === 'expired') throw new Error('Enrollment expired');

            const remaining = Math.max(0, deadline - Date.now());
            await new Promise((resolve) => setTimeout(resolve, Math.min(1500, remaining)));
        }

        throw new Error('Enrollment expired');
    }

    async function start(provider: Provider): Promise<void> {
        if (provider.enabled === false) return;

        try {
            const discovery = await getProviders(origin);
            const current = discovery.providers.find((candidate) => candidate.id === provider.id);
            if (!current || current.enabled === false) {
                setLoadedProviders((previous) =>
                    previous.map((candidate) =>
                        candidate.id === provider.id ? { ...candidate, enabled: false } : candidate,
                    ),
                );
                setFeedback({
                    title: 'Provider unavailable',
                    message: `${provider.name || provider.id} is disabled on this Relay.`,
                });
                return;
            }
        } catch (error) {
            setFeedback({ title: 'Could not check provider', message: userError(error, 'Try again.') });
            return;
        }

        setBusy(true);

        const alias = `relayid.${encodeURIComponent(origin)}.${Date.now()}`;
        const seedKey = `relayid.mldsa-seed.${Date.now()}`;
        let persisted = false;

        try {
            await assertDeviceSecurityAvailable();

            const p256 = await createKeysWithOptions({
                keyAlias: alias,
                keyType: 'ec256',
                requireAuthentication: false,
                failIfExists: true,
            });
            const seed = randomBytes(32);
            const mldsaPublic = await deriveMLDSAPublicKey(seed);

            await saveSecret(seedKey, encodeBase64Url(seed));

            const created = await createEnrollment(
                origin,
                deviceName,
                {
                    p256: await getEnrollmentP256Jwk(alias, p256.publicKey),
                    mldsa65: encodeBase64Url(mldsaPublic),
                },
                'relayid://enroll',
            );

            const auth = await beginEnrollment(origin, created.id, provider.id);
            const authResult = await WebBrowser.openAuthSessionAsync(auth.authorization_url, 'relayid://enroll');
            if (authResult.type !== 'success' || !authResult.url) throw new Error('Enrollment was cancelled');
            validateEnrollmentReturnURL(authResult.url, created.id);

            const verified = await waitForVerification(created.id, created.expires_at);
            const payload = new TextEncoder().encode(verified.signing_payload);
            const signatures = {
                p256: await signP256(alias, payload, 'Complete Relay enrollment'),
                mldsa65: await signMLDSA(seedKey, payload),
            };
            const completed = await completeEnrollment(origin, created.id, signatures);

            await saveAccount(
                {
                    id: completed.id,
                    origin,
                    email: completed.email,
                    provider: completed.provider_id,
                    deviceName: completed.device_name,
                    credential: completed.credential,
                    credentialExpiresAt: completed.expires_at,
                    p256Alias: alias,
                    mldsaSeedKey: seedKey,
                    mobileCode: codeCapability,
                },
                replacement?.id,
            );
            persisted = true;

            if (replacement) {
                let cleanupWarning: string | undefined;
                try {
                    await removeLocalAccount(replacement);
                } catch (error) {
                    cleanupWarning = userError(error, 'The old Relay could not be fully removed');
                }

                await onComplete();
                if (cleanupWarning) {
                    setFeedback({
                        title: 'New enrollment complete',
                        message: `${cleanupWarning}. Retry deleting the old Relay in Settings.`,
                    });
                }
                return;
            }

            await onComplete();
        } catch (error) {
            const message = userError(error);
            if (persisted) {
                setFeedback({ title: 'Enrollment complete', message: `${message}. The new Relay remains available.` });
            } else {
                const failures = await cleanupUnpersistedKeys(alias, seedKey);
                setFeedback({
                    title: 'Enrollment stopped',
                    message:
                        failures.length === 0
                            ? message
                            : `${message}\n\nSome temporary local key material could not be removed; retry cleanup or restart enrollment.`,
                });
            }
        } finally {
            setBusy(false);
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.page}>
                <Text style={styles.title}>{replacement ? 'Re-enroll Relay' : 'Choose a provider'}</Text>
                <Text style={styles.muted}>
                    Relay opens the provider in your system browser.
                    {'\n'}
                    The app never receives provider tokens.
                </Text>

                <View style={styles.providers}>
                    {loadedProviders.map((provider) => (
                        <View
                            key={provider.id}
                            style={[styles.option, provider.enabled === false && styles.optionDisabled]}
                        >
                            <View>
                                <Text style={styles.optionText}>{provider.name || provider.id}</Text>
                                {provider.enabled === false ? (
                                    <Text style={styles.disabledText}>Unavailable</Text>
                                ) : null}
                            </View>
                            <AnimatedPressable
                                accessibilityLabel={
                                    provider.enabled === false ? `${provider.name} unavailable` : `Use ${provider.name}`
                                }
                                disabled={busy || provider.enabled === false}
                                style={[styles.optionButton, provider.enabled === false && styles.optionButtonDisabled]}
                                onPress={() => void start(provider)}
                            >
                                <ChevronRight color={theme.primaryText} size={28} strokeWidth={2} />
                            </AnimatedPressable>
                        </View>
                    ))}
                </View>

                {loadedProviders.length === 0 ? <Text style={styles.muted}>Loading providers..</Text> : null}
                <View style={styles.actions}>
                    <AnimatedPressable disabled={busy} style={styles.secondary} onPress={onBack}>
                        <Text style={styles.secondaryText}>Back</Text>
                    </AnimatedPressable>
                </View>
            </View>
            <FeedbackModal
                visible={feedback !== undefined}
                title={feedback?.title ?? ''}
                message={feedback?.message}
                actions={[{ label: 'Close', onPress: () => setFeedback(undefined) }]}
            />
        </SafeAreaView>
    );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
    const common = createCommonStyles(theme);

    return StyleSheet.create({
        ...common,
        page: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
        actions: { gap: 12 },
        providers: { gap: 12 },
        option: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            backgroundColor: theme.surface,
            minHeight: 70,
            paddingLeft: 17,
            paddingRight: 10,
        },
        optionText: { color: theme.text, fontSize: 16, fontWeight: '700' },
        optionDisabled: { opacity: 0.55 },
        disabledText: { color: theme.muted, fontSize: 13, marginTop: 3 },
        optionButton: {
            width: 48,
            height: 48,
            backgroundColor: theme.primary,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
        },
        optionButtonDisabled: { backgroundColor: theme.border },
        secondary: common.secondary,
    });
}
