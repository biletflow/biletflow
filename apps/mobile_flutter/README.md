# BiletFlow Flutter mobile

Native Flutter development starter. The existing web app and Expo scanner remain unchanged.

## Run

This starter was checked with Flutter 3.50.0 and Dart 3.14.0. Install the Android SDK through Android Studio. For iOS on macOS, install full Xcode and CocoaPods. The generated project targets Android API 24 or newer and iOS 15.5 or newer.

From the repository root:

```sh
cd apps/mobile_flutter
flutter doctor -v
flutter pub get
flutter analyze
flutter test
flutter devices
flutter run -d DEVICE_ID --dart-define=BILETFLOW_API_URL=https://YOUR-REACHABLE-BACKEND
```

Point the app at the same Next.js API and PostgreSQL instance used by the website. See the root README to start the backend locally. For an Android emulator debug build with the backend on host port 3000, use `--dart-define=BILETFLOW_API_URL=http://10.0.2.2:3000`. Use a reachable HTTPS development URL on physical devices. Keep credentials out of source control.

The Android and iOS projects include camera permissions. The Android project also includes Internet permission and disables backups for the locally stored session. Android cleartext traffic to the host emulator alias is permitted in debug builds.

## Current scope

- Native sign-in, secure local bearer-token storage, server-side sign-out and role-aware home.
- Read-only organizer event list and details, with an owner-scoped API.
- QR scanner with authorized event selection, server check-in results, attendance counts, attendee search and check-in reversal.
- API-client, authentication and scanner widget tests.

The Dart API client was checked against a local Next.js server and disposable PostgreSQL database for organizer sign-in, current user, event list and token revocation. Android and iOS builds and device tests are pending.

Validate permission denial, valid and duplicate tickets, wrong event, invalid signatures, campaign codes, canceled or refunded tickets, network loss, and backgrounding. Verify attendance counts and check-in reversal separately on Android and iOS.
