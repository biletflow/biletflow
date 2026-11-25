import 'dart:convert';

import 'package:biletflow_mobile/core/api.dart';
import 'package:biletflow_mobile/core/session.dart';
import 'package:biletflow_mobile/l10n/app_localizations.dart';
import 'package:biletflow_mobile/l10n/locale_controller.dart';
import 'package:biletflow_mobile/screens/account_access.dart';
import 'package:biletflow_mobile/screens/checkout.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  test('campaign links keep the c token and ignore plain codes', () {
    expect(campaignTokenFrom('https://biletflow.kz/e/jazz?c=abc123'), 'abc123');
    expect(campaignTokenFrom('JAZZ10'), isNull);
  });

  testWidgets('registration creates an attendee and then signs in', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({});
    final calls = <String>[];
    final api = ApiClient(
      'https://example.test',
      client: MockClient((request) async {
        calls.add(request.url.path);
        if (request.url.path == '/api/auth/sign-up/email') {
          expect(jsonDecode(request.body), {
            'name': 'Aida',
            'email': 'aida@example.test',
            'password': 'password123',
            'locale': 'en',
          });
          return http.Response('{"user":{"id":"1"}}', 200);
        }
        if (request.url.path == '/api/mobile/auth/login') {
          return http.Response('{"token":"new-token"}', 200);
        }
        expect(request.headers['authorization'], 'Bearer new-token');
        return http.Response('{"user":{"role":"ATTENDEE","name":"Aida"}}', 200);
      }),
    );
    final session = Session(api);
    addTearDown(api.close);
    addTearDown(session.dispose);

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [AppLocalizations.delegate],
        supportedLocales: AppLocalizations.supportedLocales,
        home: RegisterScreen(session: session, locales: LocaleController()),
      ),
    );
    await tester.enterText(find.byType(TextFormField).at(0), 'Aida');
    await tester.enterText(
      find.byType(TextFormField).at(1),
      'aida@example.test',
    );
    await tester.enterText(find.byType(TextFormField).at(2), 'password123');
    await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
    await tester.pumpAndSettle();

    expect(calls, [
      '/api/auth/sign-up/email',
      '/api/mobile/auth/login',
      '/api/me',
    ]);
    expect(session.role, 'ATTENDEE');
  });

  testWidgets('password reset asks the existing auth route to email a link', (
    tester,
  ) async {
    final api = ApiClient(
      'https://example.test',
      client: MockClient((request) async {
        expect(request.url.path, '/api/auth/request-password-reset');
        expect(jsonDecode(request.body), {
          'email': 'aida@example.test',
          'redirectTo': '/en/reset-password',
        });
        return http.Response('{"status":true}', 200);
      }),
    );
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [AppLocalizations.delegate],
        supportedLocales: AppLocalizations.supportedLocales,
        home: ForgotPasswordScreen(api: api),
      ),
    );
    await tester.enterText(find.byType(TextFormField), 'aida@example.test');
    await tester.tap(find.text('Send reset link'));
    await tester.pumpAndSettle();
    expect(
      find.text(
        'If an account exists for that email, a reset link is on its way.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('verifies an email link against the current account', (
    tester,
  ) async {
    final calls = <String>[];
    final api = ApiClient(
      'https://example.test',
      client: MockClient((request) async {
        calls.add(request.url.path);
        if (request.url.path == '/api/auth/verify-email') {
          expect(request.url.queryParameters, {'token': 'signed.token'});
          return http.Response('{"status":true}', 200);
        }
        expect(request.url.path, '/api/me');
        return http.Response('{"user":{"emailVerified":true}}', 200);
      }),
    )..token = 'attendee';
    final session = Session(api);
    addTearDown(api.close);
    addTearDown(session.dispose);
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [AppLocalizations.delegate],
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => Navigator.push<void>(
              context,
              MaterialPageRoute(
                builder: (_) => VerifyEmailScreen(session: session),
              ),
            ),
            child: const Text('Open verification'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open verification'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextFormField),
      'https://example.test/api/auth/verify-email?token=signed.token&callbackURL=/',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Verify email'));
    await tester.pumpAndSettle();
    expect(calls, ['/api/auth/verify-email', '/api/me']);
    expect(session.user?['emailVerified'], isTrue);
  });

  testWidgets('resets a password from the original email URL', (tester) async {
    final calls = <String>[];
    final api = ApiClient(
      'https://example.test',
      client: MockClient((request) async {
        calls.add(request.url.path);
        expect(jsonDecode(request.body), {
          'token': 'reset-token',
          'newPassword': 'new-password123',
        });
        return http.Response('{"status":true}', 200);
      }),
    );
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [AppLocalizations.delegate],
        supportedLocales: AppLocalizations.supportedLocales,
        home: ResetPasswordScreen(api: api),
      ),
    );
    await tester.enterText(find.byType(TextFormField).first,
      'http://localhost:3000/api/auth/reset-password/reset-token?callbackURL=/en/reset-password');
    await tester.enterText(find.byType(TextFormField).last, 'new-password123');
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();
    expect(calls, ['/api/auth/reset-password']);
  });

  testWidgets('checkout sends a campaign token instead of a promo code', (
    tester,
  ) async {
    String? orderBody;
    final api = ApiClient(
      'https://example.test',
      client: MockClient((request) async {
        if (request.url.path == '/api/promo/preview') {
          expect(jsonDecode(request.body)['campaignToken'], 'abc123');
          expect(jsonDecode(request.body).containsKey('code'), isFalse);
          return http.Response(
            '{"campaign":{"name":"Early bird"},"totals":{"discountKzt":500}}',
            200,
          );
        }
        if (request.url.path == '/api/me') {
          return http.Response(
            '{"user":{"name":"Aida","email":"a@example.test"}}',
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/orders') {
          orderBody = request.body;
          return http.Response(
            '{"order":{"id":"order-1","status":"AWAITING_PAYMENT"}}',
            201,
          );
        }
        return http.Response(
          '{"order":{"id":"order-1","status":"AWAITING_PAYMENT","reference":"BF1","totalKzt":7500,"tickets":[]},"payment":{"intentId":"sim_1"}}',
          200,
        );
      }),
    )..token = 'attendee';
    addTearDown(api.close);

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [AppLocalizations.delegate],
        supportedLocales: AppLocalizations.supportedLocales,
        home: CheckoutScreen(
          api: api,
          eventId: 'event-1',
          eventTitle: 'Jazz',
          lines: const [
            CheckoutLine(
              ticketTypeId: 'ga',
              name: 'General',
              priceKzt: 8000,
              quantity: 1,
            ),
          ],
          initialName: 'Aida',
          initialEmail: 'a@example.test',
          initialCampaignToken: 'https://biletflow.kz/e/jazz?c=abc123',
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Early bird'), findsOneWidget);
    await tester.tap(find.text('Place order'));
    await tester.pumpAndSettle();
    final body = jsonDecode(orderBody!) as Map<String, dynamic>;
    expect(body['campaignToken'], 'abc123');
    expect(body.containsKey('promoCode'), isFalse);
  });
}
