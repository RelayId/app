import { parsePinnedLoginQR } from '../relay/origin';
import { parseRelayConfigQR } from '../relay/origin';
import type { Account } from '../relay/models';
import { createCommonStyles } from '../styles';
import { useTheme } from '../hooks/useTheme';
import { KeyboardAvoidingView } from 'react-native';
import { Platform } from 'react-native';
import { AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { StyleSheet } from 'react-native';
import { TextInput } from 'react-native';
import { Pressable } from 'react-native';
import { View } from 'react-native';
import { CameraView } from 'expo-camera';
import { Text } from 'react-native';
import { useState } from 'react';
import { FeedbackModal } from '../components/FeedbackModal';
import { useEffect } from 'react';
import { userError } from '../uiErrors';
import { useRef } from 'react';

export type ScanProps = {
    account?: Account;
    mode?: 'login' | 'relay';
    onBack: () => void;
    onLogin: (id: string) => void;
    onRelay?: (origin: string) => void;
};

export function Scan({ account, mode = 'login', onBack, onLogin, onRelay }: ScanProps) {
    const [value, setValue] = useState('');
    const [feedback, setFeedback] = useState<{ title: string; message?: string }>();
    const handled = useRef(false);
    const scannerBackgrounded = useRef(false);
    const theme = useTheme();
    const styles = createStyles(theme);

    useEffect(() => {
        let active = true;

        const subscription = CameraView.onModernBarcodeScanned(({ data }) => {
            if (!active || handled.current) return;

            try {
                if (mode === 'relay') {
                    const origin = parseRelayConfigQR(data, __DEV__);
                    handled.current = true;
                    void CameraView.dismissScanner();
                    onRelay?.(origin);
                    return;
                }

                if (!account) return;

                const id = parsePinnedLoginQR(data, account.origin, __DEV__);
                handled.current = true;
                setValue(id);
                void CameraView.dismissScanner();
                onLogin(id);
            } catch {
                void CameraView.dismissScanner().then(() => {
                    if (active) void CameraView.launchScanner({ barcodeTypes: ['qr'] });
                });
            }
        });

        const appStateSubscription = AppState.addEventListener('change', (state) => {
            if (state !== 'active') {
                scannerBackgrounded.current = true;
                return;
            }

            if (scannerBackgrounded.current && !handled.current) {
                handled.current = true;
                onBack();
            }
        });

        void CameraView.launchScanner({ barcodeTypes: ['qr'] }).catch((error) => {
            if (!active) return;

            const message = error instanceof Error ? error.message.toLowerCase() : '';
            if (message.includes('cancel')) {
                onBack();
                return;
            }

            setFeedback({ title: 'Camera unavailable', message: userError(error, 'The camera could not be opened.') });
        });

        return () => {
            active = false;
            subscription.remove();
            appStateSubscription.remove();
            void CameraView.dismissScanner();
        };
    }, [account, mode, onLogin, onRelay]);

    function submit(): void {
        if (mode === 'relay') {
            try {
                onRelay?.(parseRelayConfigQR(value, __DEV__));
            } catch (error) {
                setFeedback({ title: 'QR rejected', message: userError(error, 'Invalid Relay address.') });
            }
            return;
        }

        if (!account) {
            setFeedback({ title: 'Add a Relay first', message: 'Connect a Relay before scanning a login.' });
            return;
        }

        try {
            onLogin(parseLoginCode(value, account.origin));
        } catch (error) {
            setFeedback({ title: 'Login code rejected', message: userError(error, 'Enter the code from the login QR code.') });
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
                    <Text style={styles.title}>{mode === 'relay' ? 'Scan Relay' : 'Scan login'}</Text>

                    <Text style={styles.muted}>
                        {mode === 'relay'
                            ? 'The full-screen scanner is opening. Scan a Relay address QR code, or paste its URL below.'
                            : 'The full-screen scanner is opening. Scan a Relay login QR code, or paste its URL below.'}
                    </Text>
                    <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder={
                            mode === 'relay' ? 'relay.example.com' : 'login code'
                        }
                        value={value}
                        onChangeText={setValue}
                        style={styles.input}
                    />
                    <View style={styles.actions}>
                        <Pressable style={styles.primary} onPress={submit}>
                            <Text style={styles.primaryText}>{mode === 'relay' ? 'Use Relay' : 'Open login'}</Text>
                        </Pressable>
                        <Pressable style={styles.secondary} onPress={onBack}>
                            <Text style={styles.secondaryText}>Cancel</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <FeedbackModal
                visible={feedback !== undefined}
                title={feedback?.title ?? ''}
                message={feedback?.message}
                actions={[{ label: 'Close', onPress: () => setFeedback(undefined) }]}
            />
        </SafeAreaView>
    );
}

function parseLoginCode(value: string, origin: string): string {
    const trimmed = value.trim();
    if (/^[A-Za-z0-9_-]+$/u.test(trimmed)) return trimmed;
    return parsePinnedLoginQR(trimmed, origin, __DEV__);
}

function createStyles(theme: ReturnType<typeof useTheme>) {
    return StyleSheet.create({
        ...createCommonStyles(theme),
        keyboard: { flex: 1 },
        page: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
        actions: { gap: 12 },
        input: {
            color: theme.text,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            padding: 15,
            fontSize: 16,
        },
    });
}
