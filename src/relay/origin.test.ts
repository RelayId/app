import { normalizeOrigin } from './origin';

describe('normalizeOrigin', () => {
    test('adds HTTPS when a relay host is entered without a scheme', () => {
        expect(normalizeOrigin('relay.example.com')).toBe('https://relay.example.com');
    });

    test('preserves an explicit HTTPS origin', () => {
        expect(normalizeOrigin('https://relay.example.com/')).toBe('https://relay.example.com');
    });
});
