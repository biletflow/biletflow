# BiletFlow Flutter mobile

## Run

Install Flutter stable, Android Studio and (for iOS) Xcode on macOS. From the repository root:

```sh
cd apps/mobile_flutter
flutter create --platforms=android,ios --project-name=biletflow_mobile --org=kz.biletflow .
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=BILETFLOW_API_URL=https://YOUR-REACHABLE-BACKEND
```

The platform folders must still be generated. Review generated changes and keep the existing lib and pubspec. Remove the generated counter-app test if present. Configure Android INTERNET and CAMERA permissions and iOS NSCameraUsageDescription in the generated manifests. Configure secure storage according to the package documentation. Commit platform folders and the resolved pubspec.lock after testing. Use HTTPS for real device testing; the default emulator URL is for local development only. Do not commit credentials.

## Current scope

- Native sign-in, secure local bearer-token storage and role-aware home.
- Read-only organizer event list and details, with an owner-scoped API.
- QR camera and server-side check-in (manual event ID in this starter).
- API-client unit tests.
