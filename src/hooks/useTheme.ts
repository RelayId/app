import { useColorScheme } from 'react-native';

export type Theme = {
    background: string;
    surface: string;
    border: string;
    borderStrong: string;
    text: string;
    muted: string;
    soft: string;
    primary: string;
    primaryText: string;
    danger: string;
};

const light: Theme = {
    background: '#fafafa',
    surface: '#ffffff',
    border: '#d4d4d8',
    borderStrong: '#18181b',
    text: '#18181b',
    muted: '#71717a',
    soft: '#e4e4e7',
    primary: '#18181b',
    primaryText: '#ffffff',
    danger: '#b91c1c',
};

const dark: Theme = {
    background: '#09090b',
    surface: '#18181b',
    border: '#3f3f46',
    borderStrong: '#fafafa',
    text: '#fafafa',
    muted: '#a1a1aa',
    soft: '#27272a',
    primary: '#fafafa',
    primaryText: '#18181b',
    danger: '#f87171',
};

export function useTheme(): Theme {
    return useColorScheme() === 'dark' ? dark : light;
}
