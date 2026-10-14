export function normalizeOrigin(input: string, development = false): string {
    const trimmed = input.trim();
    const withScheme = /^[a-z][a-z\d+.-]*:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
        throw new Error('Relay origin must contain only scheme, host, and optional port');
    }

    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if (url.protocol !== 'https:' && !(development && url.protocol === 'http:' && loopback)) {
        throw new Error('Relay origin must use HTTPS');
    }

    return url.origin;
}

export function loginURL(origin: string, id: string): URL {
    const url = new URL(`/login/${encodeURIComponent(id)}`, origin);
    return url;
}

export function parsePinnedLoginQR(value: string, origin: string, development = false): string {
    const scanned = new URL(value.trim());
    const pinned = new URL(normalizeOrigin(origin, development));

    if (scanned.protocol === 'relayid:') {
        if (
            scanned.hostname !== 'login' ||
            scanned.pathname !== '' ||
            scanned.username ||
            scanned.password ||
            scanned.hash
        ) {
            throw new Error('QR code is not a Relay login URL');
        }

        const scannedOrigin = scanned.searchParams.get('origin');
        const id = scanned.searchParams.get('id');
        if (
            !scannedOrigin ||
            !id ||
            [...scanned.searchParams.keys()].some((key) => key !== 'origin' && key !== 'id') ||
            normalizeOrigin(scannedOrigin, development) !== pinned.origin
        ) {
            throw new Error('This QR code belongs to a different Relay server');
        }

        return id;
    }

    if (scanned.protocol !== pinned.protocol || scanned.hostname !== pinned.hostname || scanned.port !== pinned.port) {
        throw new Error('This QR code belongs to a different Relay server');
    }

    const match = scanned.pathname.match(/^\/login\/([^/]+)$/u);
    if (scanned.username || scanned.password || !match || scanned.search || scanned.hash)
        throw new Error('QR code is not a Relay login URL');

    return decodeURIComponent(match[1]!);
}

export function parseRelayConfigQR(value: string, development = false): string {
    const scanned = new URL(value.trim());

    if (scanned.protocol === 'relayid:') {
        if (scanned.hostname !== 'relay' || scanned.username || scanned.password || scanned.pathname !== '') {
            throw new Error('QR code is not a Relay address');
        }

        const origin = scanned.searchParams.get('origin');
        if (!origin || [...scanned.searchParams.keys()].some((key) => key !== 'origin')) {
            throw new Error('QR code is not a Relay address');
        }

        return normalizeOrigin(origin, development);
    }

    if (scanned.pathname !== '/' || scanned.username || scanned.password || scanned.search || scanned.hash) {
        throw new Error('QR code is not a Relay address');
    }

    return normalizeOrigin(scanned.origin, development);
}

export function parseRelayLoginQR(value: string, development = false): { origin: string; id: string } {
    const scanned = new URL(value.trim());
    if (scanned.protocol !== 'relayid:' || scanned.hostname !== 'login' || scanned.pathname !== '') {
        throw new Error('QR code is not a Relay login URL');
    }

    const origin = scanned.searchParams.get('origin');
    const id = scanned.searchParams.get('id');
    if (
        !origin ||
        !id ||
        [...scanned.searchParams.keys()].some((key) => key !== 'origin' && key !== 'id') ||
        scanned.username ||
        scanned.password ||
        scanned.hash
    ) {
        throw new Error('QR code is not a Relay login URL');
    }

    return { origin: normalizeOrigin(origin, development), id };
}

export function validateEnrollmentReturnURL(rawURL: string, enrollmentID: string): void {
    const callback = new URL(rawURL);
    if (
        callback.protocol !== 'relayid:' ||
        callback.hostname !== 'enroll' ||
        (callback.pathname !== '' && callback.pathname !== '/')
    ) {
        throw new Error('Relay returned to an unexpected app URL');
    }

    if (
        callback.searchParams.get('enrollment_id') !== enrollmentID ||
        callback.searchParams.get('state') !== 'verified'
    ) {
        throw new Error('Relay enrollment was not verified');
    }
}
