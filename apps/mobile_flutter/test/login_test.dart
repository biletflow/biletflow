import 'dart:async';

import 'package:biletflow_mobile/core/api.dart';
import 'package:biletflow_mobile/core/session.dart';
import 'package:biletflow_mobile/l10n/locale_controller.dart';
import 'package:biletflow_mobile/main.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

Widget app(Session session, {LocaleController? locales}) =>
    BiletFlowApp(session: session, locales: locales ?? LocaleController());

void main() {
  testWidgets('shows a loading indicator while restoring the session', (
    tester,
  ) async {
    final api = ApiClient('https://example.test');
    final session = Session(api);
    addTearDown(api.close);
    addTearDown(session.dispose);

    await tester.pumpWidget(app(session));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Sign in'), findsNothing);
  });

  testWidgets('disables sign-in during submission and shows a server error', (
    tester,
  ) async {
    final response = Completer<http.Response>();
    final api = ApiClient(
      'https://example.test',
      client: MockClient((request) {
        expect(request.url.path, '/api/mobile/auth/login');
        expect(request.method, 'POST');
        return response.future;
      }),
    );
    final session = Session(api)..loading = false;
    addTearDown(api.close);
    addTearDown(session.dispose);

    await tester.pumpWidget(app(session));
    await tester.enterText(find.byType(TextFormField).at(0), 'a@example.test');
    await tester.enterText(find.byType(TextFormField).at(1), 'wrong-password');
    await tester.tap(find.text('Sign in'));
    await tester.pump();

    final button = find.widgetWithText(FilledButton, 'Signing in…');
    expect(tester.widget<FilledButton>(button).onPressed, isNull);

    response.complete(
      http.Response('{"error":{"code":"INVALID_CREDENTIALS"}}', 401),
    );
    await tester.pumpAndSettle();

    expect(find.text('Email or password is incorrect.'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
    expect(api.token, isNull);
  });

  testWidgets('loads the user and stores the bearer token after sign-in', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({});
    final api = ApiClient(
      'https://example.test',
      client: MockClient((request) async {
        if (request.url.path == '/api/mobile/auth/login') {
          return http.Response('{"token":"test-token"}', 200);
        }
        expect(request.url.path, '/api/me');
        expect(request.headers['authorization'], 'Bearer test-token');
        return http.Response(
          '{"user":{"role":"ATTENDEE","name":"Test Attendee"}}',
          200,
        );
      }),
    );
    final session = Session(api)..loading = false;
    addTearDown(api.close);
    addTearDown(session.dispose);

    await tester.pumpWidget(app(session));
    await tester.enterText(find.byType(TextFormField).at(0), 'a@example.test');
    await tester.enterText(find.byType(TextFormField).at(1), 'test-password');
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Sign in'), findsNothing);
    expect(session.role, 'ATTENDEE');
    expect(
      await session.storage.read(key: 'biletflow_token_https://example.test'),
      'test-token',
    );
  });

  for (final status in [200, 401, 403]) {
    testWidgets('restores a saved session with /api/me status $status', (
      tester,
    ) async {
      const storageKey = 'biletflow_token_https://example.test';
      FlutterSecureStorage.setMockInitialValues({storageKey: 'saved-token'});
      final api = ApiClient(
        'https://example.test',
        client: MockClient((request) async {
          expect(request.url.path, '/api/me');
          expect(request.headers['authorization'], 'Bearer saved-token');
          return http.Response('{"user":{"role":"ATTENDEE"}}', status);
        }),
      );
      final session = Session(api);
      addTearDown(api.close);
      addTearDown(session.dispose);

      await tester.pumpWidget(app(session));
      await session.restore();
      await tester.pumpAndSettle();

      expect(
        find.text('Sign in'),
        status == 200 ? findsNothing : findsOneWidget,
      );
      expect(
        await session.storage.read(key: storageKey),
        status == 200 ? 'saved-token' : isNull,
      );
    });
  }

  testWidgets('revokes the server session and clears the saved token', (
    tester,
  ) async {
    const storageKey = 'biletflow_token_https://example.test';
    FlutterSecureStorage.setMockInitialValues({storageKey: 'saved-token'});
    var signOutRequests = 0;
    final api = ApiClient(
      'https://example.test',
      client: MockClient((request) async {
        signOutRequests++;
        expect(request.url.path, '/api/auth/sign-out');
        expect(request.method, 'POST');
        expect(request.headers['authorization'], 'Bearer saved-token');
        return http.Response('{"success":true}', 200);
      }),
    )..token = 'saved-token';
    final session = Session(api)
      ..loading = false
      ..user = {'role': 'ATTENDEE'};
    addTearDown(api.close);
    addTearDown(session.dispose);

    await tester.pumpWidget(app(session));
    await tester.tap(find.byTooltip('Sign out'));
    await tester.pumpAndSettle();

    expect(signOutRequests, 1);
    expect(find.text('Sign in'), findsOneWidget);
    expect(api.token, isNull);
    expect(await session.storage.read(key: storageKey), isNull);
  });
}
