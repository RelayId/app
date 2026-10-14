# RelayId client

RelayId client is an Expo/React Native Android and iOS client for the RelayId device protocol. It stores device credentials locally, completes enrollment through a system browser, signs device API requests, approves Relay login transactions, and generates short-lived browser codes. It uses Expo Continuous Native Generation; `android/` and `ios/` are generated locally and are intentionally not committed.

## Development

- Node.js 22.13 or newer
- pnpm 10.33.0
- Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3

```bash
pnpm install
pnpm exec expo prebuild --clean
pnpm android
# Development-only build; this starts Metro intentionally:
pnpm android:dev
# macOS only:
pnpm ios
pnpm typecheck
pnpm doctor
```

The normal CI check is `pnpm verify`. The `CI` GitHub Actions workflow builds a bundled Android release APK on every run and publishes it as the rolling `latest` GitHub prerelease. It does not require Metro at runtime.

Expo Go is insufficient because biometric hardware keys and QuickCrypto are native modules. Use an Expo development build. To regenerate native output, remove `android/` and `ios/`, then run `pnpm exec expo prebuild --clean`.

The app follows the device light/dark appearance live through the operating system. There is no in-app theme toggle.

## Security model

Each Relay account has a non-exportable, biometric-gated P-256 key stored in the platform key store and a 32-byte ML-DSA-65 seed stored in SecureStore. Enrollment normalizes the EC256 public key into Relay's P-256 JWK format while keeping the private key non-exportable. On iOS, EC keys use Secure Enclave on supported real devices. On Android, they use Android Keystore and are hardware-backed where the device or Keystore provides TEE or StrongBox support. `allowDeviceCredentials: true` enables Android device-credential fallback on supported Android versions. The seed is imported only at signing time; it is never placed in AsyncStorage, logs, the network, or app state. Relay credentials are opaque and are never decoded.

QR codes are pinned to the selected account's exact scheme, host, port, and `/login/<id>` path. A foreign origin is rejected before any credential or signature is sent. Enrollment opens Relay's authorization URL in the system browser; provider secrets never enter the app.

## Wear OS bridge

On Android, RelayId exposes a local native module for the companion Wear OS app. After the phone is unlocked, it silently registers a scoped, code-only watch capability with Relay, stores that capability in Android Keystore-backed native storage, and publishes enrolled Relay metadata to the watch. Wear OS installation and updates are handled by Google Play; the phone does not transfer or install APK files. The phone's native Wear listener handles watch requests while the phone UI is locked by calling Relay's watch code endpoint and returning only the short-lived code, group count, and expiry to the requesting watch. The capability cannot approve logins, enroll providers, or call normal device endpoints. Device keys, ML-DSA seeds, opaque Relay credentials, scoped watch capabilities, and provider tokens never reach the watch.

The native app registers the `relayid://` scheme. Enrollment uses `relayid://enroll` as its browser return URI and accepts the callback only when it has the matching `enrollment_id` and `state=verified` query value. The callback carries no credentials; it only wakes the app so the app can fetch the verified enrollment state and finish signing locally.

## Protocol readiness

The app implements canonical request construction, P-256 signing, ML-DSA-65 signing with an empty FIPS 204 context, key storage, origin pinning, and the required API shapes. Domain separation is carried by the request canonical prefix and the `relay-enrollment` enrollment payload prefix. The mandatory device/server interoperability test is still required on a native development build before declaring production readiness.

No Relay server secrets, OAuth client secrets, production seeds, or private keys are bundled.

## GitHub Actions

- `CI` installs the pinned pnpm lockfile, runs TypeScript checks and Jest, verifies the Expo project configuration, then generates native output temporarily, builds a bundled release APK, and updates the rolling `latest` GitHub prerelease. Native folders are never committed.

## License

RelayId is distributed under the GNU General Public License v3. The complete license text is in `LICENSE`.
