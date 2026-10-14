export function userError(error: unknown, fallback = 'Something went wrong. Try again.'): string {
    const message = error instanceof Error ? error.message : '';
    const value = message.toLowerCase();

    if (value.includes('timed out') || value.includes('failed to fetch') || value.includes('network request failed'))
        return 'The Relay could not be reached. Check the address and your connection.';
    if (value.includes('all configured providers')) return 'All configured providers for this Relay are already connected.';
    if (value.includes('already connected')) return 'This Relay provider is already connected on this device.';
    if (value.includes('no sign-in providers')) return 'This Relay has no available sign-in providers.';
    if (value.includes('expired')) return 'This request expired. Start again.';
    if (value.includes('cancelled')) return 'The sign-in was cancelled.';
    if (value.includes('disabled on this relay')) return 'That provider is no longer available on this Relay.';
    if (value.includes('too many') || value.includes('rate limit') || value.includes('attempts'))
        return 'Too many attempts. Wait a moment and try again.';
    if (value.includes('device pin') || value.includes('biometric lock'))
        return 'Set a device PIN, password, or biometric lock before continuing.';
    if (value.includes('signing was cancelled')) return 'Device authentication was cancelled.';
    if (value.includes('invalid') || value.includes('rejected'))
        return 'The scanned value is not valid for this Relay.';
    if (value.includes('not pending') || value.includes('no longer pending'))
        return 'This request is no longer available.';

    return fallback;
}
