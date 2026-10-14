import { SafeAreaView } from 'react-native-safe-area-context';
import { FeedbackModal } from '../../components/FeedbackModal';
import type { Account } from '../../relay/models';
import { createCommonStyles } from '../../styles';
import { useTheme } from '../../hooks/useTheme';
import { generateCode } from '../api';
import { StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { userError } from '../../uiErrors';
import { View } from 'react-native';
import { useCallback } from 'react';
import { Text } from 'react-native';
import { useEffect } from 'react';
import { useState } from 'react';
import { useRef } from 'react';

export type CodeProps = {
    account: Account;
    onBack: () => void;
};

export function Code({ account, onBack }: CodeProps) {
    const [code, setCode] = useState<string>();
    const [expiresAt, setExpiresAt] = useState<string>();
    const [error, setError] = useState<string>();
    const [feedback, setFeedback] = useState<{ title: string; message?: string }>();
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(Date.now());
    const generating = useRef(false);
    const theme = useTheme();
    const styles = createStyles(theme);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const create = useCallback(
        async (automatic = false): Promise<void> => {
            if (generating.current) return;

            generating.current = true;
            setBusy(true);
            setError(undefined);

            if (automatic) {
                setCode(undefined);
                setExpiresAt(undefined);
            }

            try {
                const result = await generateCode(account);
                setCode(result.code);
                setExpiresAt(result.expires_at);
            } catch (error) {
                const message = userError(error);
                setError(automatic ? message : undefined);
                if (!automatic) setFeedback({ title: 'Could not generate code', message });
            } finally {
                generating.current = false;
                setBusy(false);
            }
        },
        [account],
    );

    useEffect(() => {
        void create(true);
    }, [create]);

    const remaining = expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000)) : 0;

    useEffect(() => {
        if (expiresAt && remaining === 0) void create(true);
    }, [create, expiresAt, remaining]);

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.page}>
                <Text style={styles.title}>Generate code</Text>
                <Text style={styles.muted}>Use this code only for a Relay browser sign-in you initiated.</Text>
                {code ? (
                    <Text selectable style={styles.code}>
                        {code}
                    </Text>
                ) : null}
                {busy && !code ? <Text style={styles.expiry}>Generating a fresh code..</Text> : null}
                {expiresAt ? (
                    <Text style={styles.expiry}>
                        {remaining > 0 ? `Expires in ${remaining}s` : 'Refreshing code..'}
                    </Text>
                ) : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Text style={styles.centeredMuted}>A new code will be generated automatically.</Text>
                <View style={styles.actions}>
                    <Pressable disabled={busy} style={styles.primary} onPress={() => void create()}>
                        <Text style={styles.primaryText}>{code ? 'Refresh code' : 'Generate code'}</Text>
                    </Pressable>
                    <Pressable style={styles.secondary} onPress={onBack}>
                        <Text style={styles.secondaryText}>Back</Text>
                    </Pressable>
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

export function createStyles(theme: ReturnType<typeof useTheme>) {
    const common = createCommonStyles(theme);

    return StyleSheet.create({
        ...common,
        page: { flex: 1, justifyContent: 'center', padding: 24, gap: 18 },
        code: {
            color: theme.text,
            fontSize: 40,
            letterSpacing: 7,
            fontWeight: '800',
            textAlign: 'center',
            padding: 28,
        },
        expiry: { textAlign: 'center', color: theme.muted },
        centeredMuted: { ...common.muted, textAlign: 'center' },
        error: { textAlign: 'center', color: theme.danger },
        actions: { gap: 12 },
    });
}
