# BiletFlow Flutter mobile

Native Flutter client for the same Next.js API and PostgreSQL database as the website. No WebView.

## Run

Checked with Flutter 3.50.x and Dart 3.14. Install the Android SDK through Android Studio. For iOS on macOS, install full Xcode and CocoaPods. Targets Android API 24+ and iOS 15.5+.

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

Point the app at the same backend the website uses. For an Android emulator with the API on host port 3000:

`--dart-define=BILETFLOW_API_URL=http://10.0.2.2:3000`

For a USB-connected Android device, run `adb reverse tcp:3300 tcp:3300` and point the debug app at `http://127.0.0.1:3300` when the backend listens on port 3300.

iOS Simulator can use `http://127.0.0.1:3000` when the API listens on localhost. Physical devices need a reachable HTTPS (or LAN) URL. Keep credentials out of source control.

Android and iOS projects include camera permissions. Android includes Internet permission, disables backups for the stored session, and allows cleartext to the emulator host alias and USB loopback in debug builds.

## Current scope

- Sign-in, secure bearer storage, sign-out, role-aware home, EN/RU/KK locale switcher.
- Attendee: event catalog/search/filters, event detail + quantity selection, checkout, authenticated simulated payment, My Tickets with server QR PNG and PDF share.
- Organizer: read-only event list/details.
- Scanner: authorized event selection, check-in, counts, attendee search, reversal.
- Shared theme tokens aligned with the web Figma brand; reusable event card, status badge, quantity stepper, empty/error states.
- Widget and API smoke tests; GitHub Actions runs `flutter analyze` and `flutter test`.

## Device verification (#134)

CI covers analyze + unit/widget tests on Linux. Native APK/IPA and physical-device runs still need a machine with Android SDK and/or full Xcode. Record results honestly per platform:

```sh
flutter doctor -v
flutter build apk --debug
flutter build ios --simulator --no-codesign
flutter run -d <android-or-ios-device> --dart-define=BILETFLOW_API_URL=...
```

Validate permission denial, valid/duplicate scans, wrong event, invalid signatures, campaign codes, canceled/refunded tickets, offline, and backgrounding on each platform you claim.

## Demo rehearsal (#135)

Against a seeded disposable backend:

1. Web: organizer publish + activation; attendee free/paid purchase; Mailpit notifications; PDF.
2. Flutter: sign in as attendee → Browse events → checkout → Approve simulated payment → My tickets → show QR.
3. Flutter scanner (staff): select event → scan ticket → duplicate rejected → attendance updates.
4. Switch EN/RU/KK on login/home and re-check ticket/payment labels.

Use synthetic accounts only. If a platform is untested, say so in the presentation.
