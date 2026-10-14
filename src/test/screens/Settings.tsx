import { getConnectedWatches, getWatchInstallerStatus, installWatchArtifact, type WatchDevice } from 'relayid-wear';
import { authenticateWithOptions } from '@sbaiahmed1/react-native-biometrics';
import { checkForUpdates, getDirectApkUrl } from '../../relay/updates';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { removeAllLocalAccounts } from '../../relay/keyLifecycle';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeedbackModal } from '../../components/FeedbackModal';
import { removeLocalAccount } from '../../relay/keyLifecycle';
import { RotateCcw } from 'lucide-react-native';
import type { Account } from '../../relay/models';
import { createCommonStyles } from '../../styles';
import { getWatchStatus } from 'relayid-wear';
import { useTheme } from '../../hooks/useTheme';
import { Trash2 } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native';
import { userError } from '../../uiErrors';
import { View } from 'react-native';
import { Text } from 'react-native';
import { useEffect } from 'react';
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
    const [watchStatus, setWatchStatus] = useState<{ connected: number; installed: number }>();
    const [watchStatusLoading, setWatchStatusLoading] = useState(true);
    const [watchInstalling, setWatchInstalling] = useState(false);
    const [watchStatusError, setWatchStatusError] = useState<string>();
    const [watchPickerVisible, setWatchPickerVisible] = useState(false);
    const [watchChoices, setWatchChoices] = useState<WatchDevice[]>([]);

    async function refreshWatchStatus(): Promise<void> {
        setWatchStatusLoading(true);
        setWatchStatusError(undefined);
        await new Promise((resolve) => setTimeout(resolve, 120));
        setWatchStatus({ connected: 1, installed: 0 });
        setWatchStatusLoading(false);
    }

    async function installWatch(targetNodeId: string): Promise<void> {
        void targetNodeId;
        setWatchInstalling(true);
        setWatchStatusError(undefined);
        await new Promise((resolve) => setTimeout(resolve, 250));
        setWatchInstalling(false);
        setFeedback({ title: 'Watch installer ready', message: 'Demo state: the Watch installer is ready.' });
    }

    async function chooseWatch(): Promise<void> {
        setWatchStatusError(undefined);
        setFeedback({ title: 'Choose a Watch', message: 'Demo state: one connected Wear OS watch is available.' });
    }

    useEffect(() => {
        void refreshWatchStatus();
    }, []);

    async function authenticate(action: string): Promise<boolean> {
        void action;
        return true;
    }

    async function remove(account: Account): Promise<void> {
        void account;
        await onDeleted();
    }

    async function removeAll(): Promise<void> {
        await onDeleted();
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

                <View style={styles.watchCard}>
                    <Text style={styles.sectionTitle}>RelayId Watch</Text>
                    <Text style={styles.muted}>
                        {watchStatusLoading
                            ? 'Checking connected watches..'
                            : watchStatus?.connected
                              ? `${watchStatus.connected} connected ${watchStatus.connected === 1 ? 'watch' : 'watches'}; ${watchStatus.installed} ${watchStatus.installed === 1 ? 'has' : 'have'} RelayId installed.`
                              : 'Connect awatch to install and manage RelayId Watch.'}
                    </Text>
                    {watchStatusError ? <Text style={styles.errorText}>{watchStatusError}</Text> : null}
                    <AnimatedPressable
                        style={styles.secondary}
                        onPress={() => void chooseWatch()}
                        disabled={watchInstalling || !watchStatus?.connected}
                    >
                        <Text style={styles.secondaryText}>{watchInstalling ? 'Sending Watch installer..' : 'Install or update Watch'}</Text>
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.secondary} onPress={() => void refreshWatchStatus()}>
                        <Text style={styles.secondaryText}>{watchStatusLoading ? 'Refreshing Watch status..' : 'Refresh Watch status'}</Text>
                    </AnimatedPressable>
                </View>

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
                visible={watchPickerVisible}
                title="Choose a Watch"
                message="Select which connected Wear OS watch should receive the installer."
                actions={[
                    ...watchChoices.map((watch) => ({
                        label: `${watch.displayName || 'Wear OS watch'}${watch.nearby ? '' : ' (via phone)'}`,
                        onPress: () => {
                            setWatchPickerVisible(false);
                            void installWatch(watch.id);
                        },
                    })),
                    { label: 'Cancel', onPress: () => setWatchPickerVisible(false) },
                ]}
            />
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
        errorText: { color: theme.danger, fontSize: 13 },
        watchCard: {
            gap: 10,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            backgroundColor: theme.surface,
        },
        secondary: common.secondary,
        danger: { ...common.secondary, borderColor: theme.danger },
        dangerText: { ...common.secondaryText, color: theme.danger },
    });
}

function originLabel(origin: string): string {
    return origin.replace(/^https?:\/\//u, '').replace(/\/$/u, '');
}
