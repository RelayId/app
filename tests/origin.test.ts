import {
    normalizeOrigin,
    parsePinnedLoginQR,
    parseRelayConfigQR,
    parseRelayLoginQR,
    validateEnrollmentReturnURL,
} from '../src/relay/origin';

describe('Relay origin pinning', () => {
    test('normalizes production HTTPS origins', () => {
        expect(normalizeOrigin('https://relay.example.com/')).toBe('https://relay.example.com');
    });

    test('allows loopback HTTP only in development', () => {
        expect(normalizeOrigin('http://127.0.0.1:3000', true)).toBe('http://127.0.0.1:3000');
        expect(() => normalizeOrigin('http://relay.example.com', true)).toThrow();
    });

    test('accepts only a same-origin login URL', () => {
        expect(parsePinnedLoginQR('https://relay.example.com/login/abc', 'https://relay.example.com')).toBe('abc');
        expect(
            parsePinnedLoginQR(
                'relayid://login?origin=https%3A%2F%2Frelay.example.com&id=abc',
                'https://relay.example.com',
            ),
        ).toBe('abc');
        expect(() => parsePinnedLoginQR('https://evil.example/login/abc', 'https://relay.example.com')).toThrow();
        expect(() => parsePinnedLoginQR('https://relay.example.com/enroll/abc', 'https://relay.example.com')).toThrow();
        expect(() =>
            parsePinnedLoginQR('https://relay.example.com/login/abc?x=1', 'https://relay.example.com'),
        ).toThrow();
    });

    test('parses a login deep link before account selection', () => {
        expect(parseRelayLoginQR('relayid://login?origin=https%3A%2F%2Frelay.example.com&id=abc')).toEqual({
            origin: 'https://relay.example.com',
            id: 'abc',
        });
        expect(() => parseRelayLoginQR('relayid://login?origin=https%3A%2F%2Frelay.example.com')).toThrow();
        expect(() => parseRelayLoginQR('relayid://login?origin=http%3A%2F%2Frelay.example.com&id=abc')).toThrow();
    });

    test('accepts only a bare Relay origin configuration QR', () => {
        expect(parseRelayConfigQR('https://relay.example.com/')).toBe('https://relay.example.com');
        expect(parseRelayConfigQR('relayid://relay?origin=https%3A%2F%2Frelay.example.com')).toBe(
            'https://relay.example.com',
        );
        expect(() => parseRelayConfigQR('https://relay.example.com/login/abc')).toThrow();
        expect(() => parseRelayConfigQR('https://relay.example.com/?origin=other')).toThrow();
        expect(() => parseRelayConfigQR('relayid://relay?origin=https%3A%2F%2Frelay.example.com&extra=1')).toThrow();
        expect(() => parseRelayConfigQR('http://relay.example.com', true)).toThrow();
    });

    test('accepts a loopback HTTP QR only in development', () => {
        expect(parsePinnedLoginQR('http://127.0.0.1:3000/login/abc', 'http://127.0.0.1:3000', true)).toBe('abc');
        expect(() => parsePinnedLoginQR('http://127.0.0.1:3000/login/abc', 'http://127.0.0.1:3000')).toThrow();
    });

    test('accepts only the verified Relay enrollment callback', () => {
        expect(() =>
            validateEnrollmentReturnURL('relayid://enroll?enrollment_id=e-1&state=verified', 'e-1'),
        ).not.toThrow();
        expect(() => validateEnrollmentReturnURL('relayid://wrong?enrollment_id=e-1&state=verified', 'e-1')).toThrow();
        expect(() => validateEnrollmentReturnURL('relayid://enroll?enrollment_id=e-2&state=verified', 'e-1')).toThrow();
        expect(() => validateEnrollmentReturnURL('relayid://enroll?enrollment_id=e-1&state=pending', 'e-1')).toThrow();
        expect(() =>
            validateEnrollmentReturnURL('relayid://enroll/callback?enrollment_id=e-1&state=verified', 'e-1'),
        ).toThrow();
    });
});
