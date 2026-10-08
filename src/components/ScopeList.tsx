import { useTheme } from '../hooks/useTheme';
import { StyleSheet } from 'react-native';
import { View } from 'react-native';
import { Text } from 'react-native';

export type ScopeListProps = {
    scopes: string[];
};

const labels: Record<string, string> = { openid: 'Sign in', email: 'Email address', profile: 'Profile name' };

export function ScopeList({ scopes }: ScopeListProps) {
    const theme = useTheme();
    const styles = StyleSheet.create({
        list: { gap: 7 },
        item: { color: theme.muted, fontSize: 16 },
    });

    return (
        <View style={styles.list}>
            {scopes.map((scope) => (
                <Text key={scope} style={styles.item}>
                    • {labels[scope] ?? scope}
                </Text>
            ))}
        </View>
    );
}
