import type { Theme } from './hooks/useTheme';
import { StyleSheet } from 'react-native';

export function createCommonStyles(theme: Theme) {
    return StyleSheet.create({
        safe: { flex: 1, backgroundColor: theme.background },
        title: { color: theme.text, fontSize: 30, fontWeight: '800', marginBottom: -6 },
        muted: { color: theme.muted, fontSize: 16, lineHeight: 23 },
        primary: {
            backgroundColor: theme.primary,
            minHeight: 54,
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        primaryText: { color: theme.primaryText, fontSize: 16, fontWeight: '700' },
        secondary: {
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            minHeight: 54,
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        secondaryText: { color: theme.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
    });
}
