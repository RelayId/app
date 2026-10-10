import type { Account, MobileCodeCapability } from '../relay/models';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { ChevronRight } from 'lucide-react-native';
import { ChevronDown } from 'lucide-react-native';
import { createCommonStyles } from '../styles';
import { useTheme } from '../hooks/useTheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { Animated } from 'react-native';
import { Modal } from 'react-native';
import { View } from 'react-native';
import { Text } from 'react-native';
import { useEffect } from 'react';
import { useState } from 'react';
import { useRef } from 'react';

export type HomeProps = {
    accounts: Account[];
    selectedAccountId?: string;
    onSelect: (id: string) => void;
    onAdd: () => void;
    onScan: () => void;
    onCode: () => void;
    mobileCode?: MobileCodeCapability;
    onSettings: () => void;
};

export function Home({
    accounts,
    selectedAccountId,
    onSelect,
    onAdd,
    onScan,
    onCode,
    mobileCode,
    onSettings,
}: HomeProps) {
    const entrance = useRef(new Animated.Value(0)).current;
    const [pickerOpen, setPickerOpen] = useState(false);
    const theme = useTheme();
    const styles = createStyles(theme);
    const selectedAccount = accounts.find((account) => account.id === selectedAccountId);

    useEffect(() => {
        Animated.timing(entrance, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
        }).start();
    }, [entrance]);

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.page}>
                <Animated.View
                    style={[
                        styles.content,
                        {
                            opacity: entrance,
                            transform: [
                                { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                            ],
                        },
                    ]}
                >
                    <View style={styles.illustration}>
                        <View style={styles.illustrationTop} />
                        <View style={styles.illustrationBody}>
                            <View style={styles.illustrationDot} />
                            <View style={styles.illustrationLine} />
                        </View>
                    </View>

                    <Text style={styles.title}>{accounts.length === 0 ? 'Welcome to RelayId' : 'Your relays'}</Text>

                    {accounts.length === 0 ? (
                        <Text style={styles.muted}>
                            Connect a Relay to approve sign-ins and generate secure login codes.
                        </Text>
                    ) : selectedAccount ? (
                        <Pressable style={styles.selector} onPress={() => setPickerOpen(true)}>
                            <View style={styles.selectorText}>
                                <Text style={styles.selectorLabel}>Active Relay</Text>
                                <Text style={styles.selectorName} numberOfLines={1}>
                                    {originLabel(selectedAccount.origin)}
                                </Text>
                            </View>
                            <ChevronDown color={theme.text} size={21} />
                        </Pressable>
                    ) : null}

                    <View style={styles.actions}>
                        {accounts.length > 0 ? (
                            <>
                                <AnimatedPressable style={styles.primary} onPress={onScan}>
                                    <Text style={styles.primaryText}>Scan login</Text>
                                </AnimatedPressable>
                                {mobileCode?.enabled ? (
                                    <AnimatedPressable style={styles.secondary} onPress={onCode}>
                                        <Text style={styles.secondaryText}>Generate code</Text>
                                    </AnimatedPressable>
                                ) : null}
                            </>
                        ) : null}
                        <AnimatedPressable
                            style={accounts.length > 0 ? styles.secondary : styles.primary}
                            onPress={onAdd}
                        >
                            <Text style={accounts.length > 0 ? styles.secondaryText : styles.primaryText}>
                                Add Relay
                            </Text>
                        </AnimatedPressable>
                    </View>
                </Animated.View>
            </View>
            <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.picker}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.pickerTitle}>Choose a Relay</Text>
                        <View style={styles.pickerList}>
                            {accounts.map((account) => (
                                <Pressable
                                    key={account.id}
                                    style={[
                                        styles.pickerRow,
                                        account.id === selectedAccountId && styles.pickerSelected,
                                    ]}
                                    onPress={() => {
                                        onSelect(account.id);
                                        setPickerOpen(false);
                                    }}
                                >
                                    <View style={styles.pickerText}>
                                        <Text style={styles.pickerName} numberOfLines={1}>
                                            {account.email}
                                        </Text>
                                        <View style={styles.pickerDetailRow}>
                                            <View style={styles.pickerDot} />
                                            <Text style={styles.pickerDetail} numberOfLines={1}>
                                                {originLabel(account.origin)}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.pickerIcon}>
                                        <ChevronRight color={theme.primaryText} size={23} strokeWidth={2} />
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                        <View style={styles.actions}>
                            <AnimatedPressable style={styles.secondary} onPress={onSettings}>
                                <Text style={styles.secondaryText}>Settings</Text>
                            </AnimatedPressable>
                            <AnimatedPressable style={styles.secondary} onPress={() => setPickerOpen(false)}>
                                <Text style={styles.secondaryText}>Close</Text>
                            </AnimatedPressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
    const common = createCommonStyles(theme);

    return StyleSheet.create({
        ...common,
        page: { flex: 1, padding: 24 },
        content: { flex: 1, justifyContent: 'center', gap: 16 },
        illustration: {
            alignSelf: 'center',
            width: 112,
            height: 112,
            borderRadius: 28,
            backgroundColor: theme.soft,
            padding: 18,
            gap: 8,
            marginBottom: 4,
        },
        illustrationTop: { height: 14, width: 48, borderRadius: 7, backgroundColor: theme.primary },
        illustrationBody: {
            flex: 1,
            borderRadius: 14,
            backgroundColor: theme.primary,
            padding: 12,
            justifyContent: 'center',
            gap: 10,
        },
        illustrationDot: { height: 12, width: 12, borderRadius: 6, backgroundColor: theme.background },
        illustrationLine: { height: 8, width: 50, borderRadius: 4, backgroundColor: theme.muted },
        title: { ...common.title, textAlign: 'center' },
        muted: { ...common.muted, textAlign: 'center' },
        actions: { gap: 12 },
        selector: {
            minHeight: 58,
            marginTop: 24,
            marginBottom: 20,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 13,
            backgroundColor: theme.surface,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        selectorText: { flex: 1, gap: 3 },
        selectorLabel: { color: theme.muted, fontSize: 12, fontWeight: '600' },
        selectorName: { color: theme.text, fontSize: 16, fontWeight: '700' },
        modalBackdrop: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0, 0, 0, 0.38)',
        },
        picker: {
            width: '100%',
            maxHeight: '80%',
            gap: 12,
            padding: 18,
            paddingBottom: 32,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            backgroundColor: theme.background,
        },
        sheetHandle: {
            alignSelf: 'center',
            width: 38,
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.soft,
            marginBottom: 2,
        },
        pickerTitle: { color: theme.text, fontSize: 21, fontWeight: '800' },
        pickerList: { gap: 8 },
        pickerRow: {
            flexDirection: 'row',
            minHeight: 68,
            padding: 13,
            paddingRight: 10,
            gap: 12,
            borderRadius: 11,
            borderWidth: 1,
            borderColor: theme.soft,
            backgroundColor: theme.surface,
            alignItems: 'center',
        },
        pickerSelected: { borderColor: theme.borderStrong },
        pickerText: { flex: 1, gap: 3 },
        pickerName: { color: theme.text, fontSize: 16, fontWeight: '700' },
        pickerDetail: { flex: 1, color: theme.text, fontSize: 14, fontWeight: '500', opacity: 0.68 },
        pickerDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        pickerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.text, opacity: 0.68 },
        pickerIcon: {
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.primary,
        },
    });
}

function originLabel(origin: string): string {
    return origin.replace(/^https?:\/\//u, '').replace(/\/$/u, '');
}
