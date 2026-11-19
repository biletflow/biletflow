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
- QR scanner with an authorized event picker, server-side check-in results, attendance counts, attendee search and check-in reversal.
- API-client, authentication and scanner widget tests.

The Dart API client was checked against a local Next.js server and disposable PostgreSQL database for organizer sign-in, current user, event list and token revocation. Android and iOS builds and device tests are pending.

Use the [physical-phone scan matrix](../scanner/README.md#issue-116-physical-phone-test-matrix) for the same ticket cases on Flutter. Record Flutter and Expo runs separately. For Flutter, also verify attendance after a valid scan, reverse that check-in with a reason, and confirm the refreshed count and that the ticket can be checked in again. Check that going to the background stops the camera until the tester explicitly starts another scan.

Registration, attendee checkout and tickets, organizer management and analytics, admin, support and refunds, campaigns and full localization remain open. See issues #121 through #135. All screens use native Flutter widgets.
