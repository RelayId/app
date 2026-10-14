import { SafeAreaView } from 'react-native-safe-area-context';
import { FeedbackModal } from '../../components/FeedbackModal';
import type { Account, Login } from '../../relay/models';
import { ScopeList } from '../../components/ScopeList';
import { createCommonStyles } from '../../styles';
import { useTheme } from '../../hooks/useTheme';
import { approveLogin } from '../api';
import { StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { denyLogin } from '../api';
import { userError } from '../../uiErrors';
import { getLogin } from '../api';
import { View } from 'react-native';
import { Text } from 'react-native';
import { useEffect } from 'react';
import { useState } from 'react';

export type ApproveProps = {
    account: Account;
    id: string;
    onBack: () => void;
};

export function Approve({ account, id, onBack }: ApproveProps) {
    const [login, setLogin] = useState<Login>();
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<{ title: string; message?: string }>();
    const [now, setNow] = useState(Date.now());
    const [expired, setExpired] = useState(false);

    const theme = useTheme();
    const styles = createStyles(theme);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        void getLogin(account, id)
            .then((loaded) => {
                if (loaded.state !== 'pending') throw new Error('This login is no longer pending. Scan it again.');
                setLogin(loaded);
            })
            .catch((error) => setFeedback({ title: 'Could not load login', message: userError(error, 'Try again.') }));
    }, [account, id]);

    useEffect(() => {
        if (!login || expired || Date.parse(login.expires_at) > now) return;

        setExpired(true);
    }, [expired, login, now]);

    useEffect(() => {
        if (!expired) return;

        const redirect = setTimeout(onBack, 1200);
        return () => clearTimeout(redirect);
    }, [expired, onBack]);

    async function decide(action: 'approve' | 'deny'): Promise<void> {
        if (!login || login.state !== 'pending') {
            setFeedback({ title: 'Login unavailable', message: 'Scan the login again.' });
            return;
        }

        setBusy(true);

        try {
            if (action === 'approve') {
                await approveLogin(account, id, login.challenge);
            } else {
                await denyLogin(account, id, login.challenge);
            }

            setFeedback({ title: action === 'approve' ? 'Approved' : 'Denied' });
            onBack();
        } catch (error) {
            setFeedback({ title: 'Request failed', message: userError(error, 'Try again.') });
        } finally {
            setBusy(false);
        }
    }

    const scopes = login?.scope.split(/\s+/u).filter(Boolean) ?? [];

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.page}>
                <Text style={styles.title}>Approve sign-in</Text>

                {expired ? (
                    <>
                        <Text style={styles.client}>Request expired</Text>
                        <Text style={styles.muted}>
                            This sign-in request was cancelled because it reached its expiry time.
                        </Text>
                        <Text style={styles.expiry}>Returning to your Relays..</Text>
                    </>
                ) : login ? (
                    <>
                        <Text style={styles.origin}>{account.origin}</Text>
                        <Text style={styles.client}>{login.client.name}</Text>
                        <Text style={styles.muted}>Requested access:</Text>
                        <ScopeList scopes={scopes} />
                        <Text style={styles.expiry}>
                            {`Expires in ${Math.max(0, Math.ceil((Date.parse(login.expires_at) - now) / 1000))}s`}
                        </Text>

                        <View style={styles.actions}>
                            <Pressable disabled={busy} style={styles.primary} onPress={() => void decide('approve')}>
                                <Text style={styles.primaryText}>Approve</Text>
                            </Pressable>
                            <Pressable disabled={busy} style={styles.secondary} onPress={() => void decide('deny')}>
                                <Text style={styles.secondaryText}>Deny</Text>
                            </Pressable>
                            <Pressable disabled={busy} style={styles.secondary} onPress={onBack}>
                                <Text style={styles.secondaryText}>Cancel</Text>
                            </Pressable>
                        </View>
                    </>
                ) : (
                    <Text style={styles.muted}>Loading request..</Text>
                )}
                {!login ? (
                    <View style={styles.actions}>
                        <Pressable disabled={busy} style={styles.secondary} onPress={onBack}>
                            <Text style={styles.secondaryText}>Cancel</Text>
                        </Pressable>
                    </View>
                ) : null}
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
    return StyleSheet.create({
        ...createCommonStyles(theme),
        page: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
        origin: { color: theme.muted },
        client: { color: theme.text, fontSize: 21, fontWeight: '700' },
        expiry: { color: theme.muted, fontSize: 13 },
        actions: { gap: 12 },
    });
}
