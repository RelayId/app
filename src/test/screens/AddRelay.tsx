import type { Account, MobileCodeCapability, Provider } from '../../relay/models';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native';
import { normalizeOrigin } from '../../relay/origin';
import { createCommonStyles } from '../../styles';
import { useTheme } from '../../hooks/useTheme';
import { QrCode } from 'lucide-react-native';
import { getProviders } from '../api';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native';
import { TextInput } from 'react-native';
import { userError } from '../../uiErrors';
import { Platform } from 'react-native';
import { Keyboard } from 'react-native';
import { View } from 'react-native';
import { Text } from 'react-native';
import { useEffect } from 'react';
import { useState } from 'react';
import { useRef } from 'react';

export type AddRelayProps = {
    existingAccounts: Pick<Account, 'origin' | 'provider'>[];
    initialOrigin?: string;
    onBack: () => void;
    onScan: (origin: string) => void;
    onNext: (origin: string, providers: Provider[], mobileCode: MobileCodeCapability) => void;
};

export function AddRelay({ existingAccounts, initialOrigin, onBack, onScan, onNext }: AddRelayProps) {
    const [origin, setOrigin] = useState(initialOrigin ?? '');
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string>();
    const inputRef = useRef<TextInput>(null);
    const theme = useTheme();
    const styles = createStyles(theme);

    useEffect(() => {
        if (initialOrigin) setOrigin(initialOrigin);
    }, [initialOrigin]);

    async function submit(): Promise<void> {
        setError(undefined);
        setChecking(true);

        try {
            const normalized = normalizeOrigin(origin, __DEV__);
            const discovery = await getProviders(normalized);

            const availableProviders = discovery.providers.filter(
                (provider) =>
                    !existingAccounts.some(
                        (account) => account.origin === normalized && account.provider === provider.id,
                    ),
            );

            if (availableProviders.length === 0) {
                if (discovery.providers.length > 0) {
                    throw new Error('All configured providers for this Relay are already connected.');
                }
                throw new Error('This Relay has no sign-in providers configured yet.');
            }

            onNext(normalized, availableProviders, discovery.mobileCode);
        } catch (error) {
            setError(userError(error, 'The Relay could not be reached. Check the address and try again.'));
        } finally {
            setChecking(false);
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
                <ScrollView
                    contentContainerStyle={styles.page}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    <Text style={styles.title}>Connect a Relay</Text>
                    <Text style={styles.muted}>
                        Start with the Relay address.
                        {'\n'}
                        We will check it before asking you to sign in.
                    </Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            ref={inputRef}
                            autoCapitalize="none"
                            keyboardType="url"
                            placeholder="https://relay.example.com"
                            value={origin}
                            onChangeText={setOrigin}
                            style={styles.input}
                        />
                        <AnimatedPressable
                            accessibilityLabel="Scan Relay QR code"
                            style={styles.scanButton}
                            onPress={() => {
                                inputRef.current?.blur();
                                Keyboard.dismiss();
                                onScan(origin);
                            }}
                        >
                            <QrCode color={theme.text} size={22} strokeWidth={2} />
                        </AnimatedPressable>
                    </View>
                    {checking ? <Text style={styles.status}>Checking Relay..</Text> : null}
                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    <View style={styles.actions}>
                        <AnimatedPressable disabled={checking} style={styles.primary} onPress={() => void submit()}>
                            <Text style={styles.primaryText}>{checking ? 'Checking..' : 'Check Relay'}</Text>
                        </AnimatedPressable>
                        <AnimatedPressable disabled={checking} style={styles.secondary} onPress={onBack}>
                            <Text style={styles.secondaryText}>Cancel</Text>
                        </AnimatedPressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
    const common = createCommonStyles(theme);

    return StyleSheet.create({
        ...common,
        keyboard: { flex: 1 },
        page: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
        actions: { gap: 12 },
        primary: common.primary,
        input: {
            flex: 1,
            color: theme.text,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            padding: 15,
            fontSize: 16,
        },
        inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        scanButton: {
            minWidth: 48,
            minHeight: 48,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.surface,
        },
        status: { color: theme.muted, textAlign: 'center' },
        error: { color: theme.danger, lineHeight: 21 },
    });
}
