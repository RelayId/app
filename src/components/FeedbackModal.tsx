import { Modal } from 'react-native';
import { Pressable } from 'react-native';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native';
import { View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export type FeedbackAction = {
    label: string;
    onPress: () => void;
    destructive?: boolean;
};

export type FeedbackModalProps = {
    visible: boolean;
    title: string;
    message?: string;
    actions: FeedbackAction[];
};

export function FeedbackModal({ visible, title, message, actions }: FeedbackModalProps) {
    const theme = useTheme();
    const styles = createStyles(theme);
    const hasDistinctMessage = message !== undefined && message.trim() !== '' && message.trim() !== title.trim();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={actions[0]?.onPress}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <Text style={styles.title}>{title}</Text>
                    {hasDistinctMessage ? <Text style={styles.message}>{message}</Text> : null}
                    <View style={styles.actions}>
                        {actions.map((action) => (
                            <Pressable
                                key={action.label}
                                accessibilityRole="button"
                                onPress={action.onPress}
                                style={[styles.action, action.destructive && styles.destructiveAction]}
                            >
                                <Text style={[styles.actionText, action.destructive && styles.destructiveText]}>
                                    {action.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
    return StyleSheet.create({
        backdrop: {
            flex: 1,
            backgroundColor: theme.background,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
        },
        card: {
            width: '100%',
            maxWidth: 420,
            borderRadius: 18,
            padding: 22,
            gap: 12,
            backgroundColor: theme.background,
            borderWidth: 1,
            borderColor: theme.border,
        },
        title: { color: theme.text, fontSize: 21, fontWeight: '800' },
        message: { color: theme.muted, fontSize: 16, lineHeight: 23 },
        actions: { gap: 10, marginTop: 6 },
        action: {
            minHeight: 48,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.primary,
            paddingHorizontal: 16,
        },
        actionText: { color: theme.primaryText, fontSize: 16, fontWeight: '700' },
        destructiveAction: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.danger },
        destructiveText: { color: theme.danger },
    });
}
