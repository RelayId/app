import { authenticateWithOptions } from '@sbaiahmed1/react-native-biometrics';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { removeAllLocalAccounts } from '../relay/keyLifecycle';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeedbackModal } from '../components/FeedbackModal';
import { removeLocalAccount } from '../relay/keyLifecycle';
import { RotateCcw } from 'lucide-react-native';
import type { Account } from '../relay/models';
import { createCommonStyles } from '../styles';
import { useTheme } from '../hooks/useTheme';
import { Trash2 } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native';
import { userError } from '../uiErrors';
import { View } from 'react-native';
import { Text } from 'react-native';
import { useState } from 'react';

export type SettingsProps = {
    accounts: Account[];
    onBack: () => void;
    onDeleted: () => Promise<void>;
    onReenroll: (account: Account) => void;
};

export function Settings({ accounts, onBack, onDeleted, onReenroll }: SettingsProps) {
    const theme = useTheme();
    const styles = createStyles(theme);
    const [feedback, setFeedback] = useState<{ title: string; message?: string }>();
    const [pendingDelete, setPendingDelete] = useState<Account>();
    const [deleteAllPending, setDeleteAllPending] = useState(false);
    async function authenticate(action: string): Promise<boolean> {
        try {
            const result = await authenticateWithOptions({
                title: 'Confirm in RelayId',
                subtitle: action,
                description: 'Authenticate to continue.',
                allowDeviceCredentials: true,
                cancelLabel: 'Cancel',
            });

            if (result.success) return true;
        } catch {}

        setFeedback({ title: 'Authentication required', message: 'Authenticate on this device to continue.' });
        return false;
    }

    async function remove(account: Account): Promise<void> {
        try {
            await removeLocalAccount(account);
            await onDeleted();
        } catch (error) {
            setFeedback({
                title: 'Could not delete account',
                message: `${userError(error, 'Secure cleanup failed.')} Retry deletion from Settings.`,
            });
        }
    }

    async function removeAll(): Promise<void> {
        let cleanupError: unknown;

        try {
            await removeAllLocalAccounts(accounts);
        } catch (error) {
            cleanupError = error;
        }

        try {
            await onDeleted();
        } catch (error) {
            cleanupError ??= error;
        }

        if (cleanupError) {
            setFeedback({
                title: 'Cleanup incomplete',
                message: `${userError(cleanupError, 'Some local Relay data could not be removed.')} Retry from Settings.`,
            });
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.page}>
                <Text style={styles.title}>Settings</Text>
                <Text style={styles.muted}>
                    Accounts stay on this device. Private keys never leave their secure storage.
                </Text>

                {accounts.map((account) => (
                    <View key={account.id} style={styles.row}>
                        <View style={styles.flex}>
                            <Text style={styles.name}>{account.email}</Text>
                            <Text style={styles.muted}>{originLabel(account.origin)}</Text>
                        </View>
                        <View style={styles.buttons}>
                            <AnimatedPressable
                                accessibilityLabel={`Re-enroll ${account.email}`}
                                style={styles.iconButton}
                                onPress={() => {
                                    void authenticate('Re-enroll this Relay').then((allowed) => {
                                        if (allowed) onReenroll(account);
                                    });
                                }}
                            >
                                <RotateCcw color={theme.text} size={20} />
                            </AnimatedPressable>
                            <AnimatedPressable
                                accessibilityLabel={`Delete ${account.email}`}
                                style={styles.iconButton}
                                onPress={() => setPendingDelete(account)}
                            >
                                <Trash2 color={theme.danger} size={20} />
                            </AnimatedPressable>
                        </View>
                    </View>
                ))}

                <View style={styles.actions}>
                    {accounts.length > 0 ? (
                        <AnimatedPressable style={styles.danger} onPress={() => setDeleteAllPending(true)}>
                            <Text style={styles.dangerText}>Delete all data</Text>
                        </AnimatedPressable>
                    ) : null}
                    <AnimatedPressable style={styles.secondary} onPress={onBack}>
                        <Text style={styles.secondaryText}>Back</Text>
                    </AnimatedPressable>
                </View>
            </ScrollView>
            <FeedbackModal
                visible={pendingDelete !== undefined}
                title="Delete account?"
                message="This removes local keys and the Relay credential."
                actions={[
                    { label: 'Cancel', onPress: () => setPendingDelete(undefined) },
                    {
                        label: 'Delete',
                        destructive: true,
                        onPress: () => {
                            const account = pendingDelete;
                            setPendingDelete(undefined);
                            if (account) {
                                void authenticate('Delete this Relay').then((allowed) => {
                                    if (allowed) void remove(account);
                                });
                            }
                        },
                    },
                ]}
            />
            <FeedbackModal
                visible={deleteAllPending}
                title="Delete all data?"
                message="This removes every Relay account, credential, and local key from this device."
                actions={[
                    { label: 'Cancel', onPress: () => setDeleteAllPending(false) },
                    {
                        label: 'Delete all',
                        destructive: true,
                        onPress: () => {
                            setDeleteAllPending(false);
                            void authenticate('Delete all local Relay data').then((allowed) => {
                                if (allowed) void removeAll();
                            });
                        },
                    },
                ]}
            />
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
        page: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
        actions: { gap: 12 },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: theme.soft,
            paddingVertical: 12,
        },
        flex: { flex: 1, gap: 4 },
        buttons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
        iconButton: {
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 9,
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
        },
        name: { color: theme.text, fontWeight: '700' },
        sectionTitle: { color: theme.text, fontSize: 18, fontWeight: '700' },
        secondary: common.secondary,
        danger: { ...common.secondary, borderColor: theme.danger },
        dangerText: { ...common.secondaryText, color: theme.danger },
    });
}

function originLabel(origin: string): string {
    return origin.replace(/^https?:\/\//u, '').replace(/\/$/u, '');
}
