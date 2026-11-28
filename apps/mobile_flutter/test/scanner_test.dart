import 'package:biletflow_mobile/l10n/app_localizations.dart';

import 'dart:convert';

import 'package:biletflow_mobile/core/api.dart';
import 'package:biletflow_mobile/core/session.dart';
import 'package:biletflow_mobile/screens/scanner.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  testWidgets('selects a permitted event and refreshes counts after reversal', (
    tester,
  ) async {
    var checkedIn = 1;
    var reversalRequests = 0;
    var offline = false;
    final api = ApiClient(
      'https://example.test',
      client: MockClient((request) async {
        expect(request.headers['authorization'], 'Bearer staff-token');
        switch (request.url.path) {
          case '/api/mobile/events':
            expect(request.url.queryParameters['scope'], 'authorized');
            return http.Response(
              '{"events":[{"id":"event-a","title":"Concert"}]}',
              200,
            );
          case '/api/mobile/events/event-a/stats':
            return http.Response(
              '{"checkedIn":$checkedIn,"registered":2}',
              200,
            );
          case '/api/mobile/events/event-a/attendees':
            expect(request.url.queryParameters['q'], 'Aliya & friend');
            if (offline) throw http.ClientException('Connection refused');
            return http.Response(
              '{"attendees":[{"attendeeName":"Aliya","ticketTypeName":"General",'
              '"status":"CHECKED_IN","checkInRecordId":"record-a"}]}',
              200,
            );
          case '/api/checkin/reverse':
            reversalRequests++;
            expect(request.method, 'POST');
            expect(jsonDecode(request.body), {
              'checkInRecordId': 'record-a',
              'reason': 'Wrong entrance',
            });
            checkedIn = 0;
            return http.Response('{"reversed":true}', 200);
          default:
            fail('Unexpected scanner request: ${request.url.path}');
        }
      }),
    )..token = 'staff-token';
    final session = Session(api);
    addTearDown(api.close);
    addTearDown(session.dispose);

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: [
          AppLocalizations.delegate,
          ...GlobalMaterialLocalizations.delegates,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: ScannerScreen(session: session),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Scan ticket'), findsNothing);
    await tester.tap(find.byType(DropdownButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Concert').last);
    await tester.pumpAndSettle();
    expect(find.text('Checked in: 1 / 2'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Aliya & friend');
    await tester.tap(find.byTooltip('Search attendees'));
    await tester.pumpAndSettle();
    expect(find.text('Aliya'), findsOneWidget);

    await tester.tap(find.text('Reverse'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), 'Wrong entrance');
    await tester.tap(find.text('Reverse check-in'));
    await tester.pumpAndSettle();

    expect(reversalRequests, 1);
    expect(find.text('Checked in: 0 / 2'), findsOneWidget);
    expect(find.text('Aliya'), findsNothing);

    offline = true;
    await tester.tap(find.byTooltip('Search attendees'));
    await tester.pumpAndSettle();
    final l10n = AppLocalizations.of(tester.element(find.byType(ScannerScreen)));
    expect(find.widgetWithText(SnackBar, l10n.scanRequestFailed), findsOneWidget);
    expect(find.text('Aliya'), findsNothing);
  });
}
