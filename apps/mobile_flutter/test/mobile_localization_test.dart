import 'package:biletflow_mobile/core/api.dart';
import 'package:biletflow_mobile/core/session.dart';
import 'package:biletflow_mobile/l10n/app_localizations.dart';
import 'package:biletflow_mobile/screens/scanner.dart';
import 'package:biletflow_mobile/screens/support.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  for (final (code, scanner, event, support, empty, wrongEvent) in [
    (
      'en',
      'QR scanner',
      'Select an event',
      'Support',
      'No support requests',
      'Ticket for another event',
    ),
    (
      'ru',
      'QR-сканер',
      'Выберите событие',
      'Поддержка',
      'Нет обращений',
      'Билет на другое событие',
    ),
    (
      'kk',
      'QR сканері',
      'Іс-шараны таңдаңыз',
      'Қолдау',
      'Өтініштер жоқ',
      'Билет басқа іс-шараға арналған',
    ),
  ]) {
    testWidgets('scanner and support render in $code', (tester) async {
      final api = ApiClient(
        'https://example.test',
        client: MockClient((request) async {
          return switch (request.url.path) {
            '/api/mobile/events' => http.Response(
              '{"events":[{"id":"event1","title":"Concert"}]}',
              200,
            ),
            '/api/support/cases' => http.Response('{"cases":[]}', 200),
            _ => throw StateError('Unexpected request ${request.url.path}'),
          };
        }),
      );
      final session = Session(api);
      addTearDown(api.close);
      addTearDown(session.dispose);

      Widget localized(Widget screen) => MaterialApp(
        locale: Locale(code),
        localizationsDelegates: [
          AppLocalizations.delegate,
          ...GlobalMaterialLocalizations.delegates,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: screen,
      );

      await tester.pumpWidget(localized(ScannerScreen(session: session)));
      await tester.pumpAndSettle();
      expect(find.text(scanner), findsOneWidget);
      expect(find.text(event), findsOneWidget);
      final context = tester.element(find.byType(ScannerScreen));
      expect(
        AppLocalizations.of(context).scanResult('WRONG_EVENT'),
        wrongEvent,
      );

      await tester.pumpWidget(localized(SupportScreen(api: api)));
      await tester.pumpAndSettle();
      expect(find.text(support), findsOneWidget);
      expect(find.text(empty), findsOneWidget);
    });
  }
}
