import type { PropsWithChildren } from 'react';
import type { ViewStyle } from 'react-native';
import type { StyleProp } from 'react-native';
import { Pressable } from 'react-native';
import { Animated } from 'react-native';
import { useRef } from 'react';

export type PropsOptions = {
    accessibilityLabel?: string;
    disabled?: boolean;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
};

export function AnimatedPressable({
    accessibilityLabel,
    children,
    disabled,
    onPress,
    style,
}: PropsWithChildren<PropsOptions>) {
    const scale = useRef(new Animated.Value(1)).current;

    function animate(toValue: number): void {
        Animated.spring(scale, {
            toValue,
            damping: 18,
            stiffness: 280,
            mass: 0.7,
            useNativeDriver: true,
        }).start();
    }

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
                disabled={disabled}
                accessibilityLabel={accessibilityLabel}
                onPress={onPress}
                onPressIn={() => animate(0.98)}
                onPressOut={() => animate(1)}
                style={style}
            >
                {children}
            </Pressable>
        </Animated.View>
    );
}
