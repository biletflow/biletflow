import 'package:biletflow_mobile/core/api.dart';
import 'package:biletflow_mobile/l10n/app_localizations.dart';
import 'package:biletflow_mobile/l10n/locale_controller.dart';
import 'package:biletflow_mobile/screens/order_status.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  testWidgets('order display shows paid status and ticket row', (tester) async {
    final api = ApiClient(
      'https://example.test',
      client: MockClient((request) async {
        expect(request.url.path, '/api/orders/ord1');
        return http.Response(
          '''
          {
            "order": {
              "id": "ord1",
              "reference": "BF-1001",
              "status": "PAID",
              "totalKzt": 0,
              "tickets": [
                {
                  "id": "tkt1",
                  "ticketTypeName": "Free entry",
                  "attendeeName": "Aliya",
                  "status": "VALID"
                }
              ]
            }
          }
          ''',
          200,
        );
      }),
    );
    addTearDown(api.close);

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: [
          AppLocalizations.delegate,
          ...GlobalMaterialLocalizations.delegates,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: OrderStatusScreen(api: api, orderId: 'ord1'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('BF-1001'), findsOneWidget);
    expect(find.text('PAID'), findsOneWidget);
    expect(find.text('Free entry'), findsOneWidget);
    expect(find.textContaining('Aliya'), findsOneWidget);
  });

  testWidgets('locale switcher labels stay localized', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});
    final locales = LocaleController();
    await tester.pumpWidget(
      ListenableBuilder(
        listenable: locales,
        builder: (context, _) => MaterialApp(
          locale: locales.locale,
          localizationsDelegates: [
            AppLocalizations.delegate,
            ...GlobalMaterialLocalizations.delegates,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (context) {
              final l10n = AppLocalizations.of(context);
              return Scaffold(body: Text(l10n.myTickets));
            },
          ),
        ),
      ),
    );
    expect(find.text('My tickets'), findsOneWidget);
    await locales.setLocale(const Locale('ru'));
    await tester.pump();
    expect(find.text('Мои билеты'), findsOneWidget);
  });
}
