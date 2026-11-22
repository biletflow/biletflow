import 'package:biletflow_mobile/core/api.dart';
import 'package:biletflow_mobile/l10n/app_localizations.dart';
import 'package:biletflow_mobile/screens/organizer.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  testWidgets('filters organizer events and opens ticket inventory', (
    tester,
  ) async {
    final api = ApiClient(
      'https://example.test',
      client: MockClient((request) async {
        expect(request.headers['authorization'], 'Bearer organizer-token');
        if (request.url.path == '/api/organizer/events') {
          return http.Response(
            '{"events":[{"id":"draft","title":"Dance show","status":"DRAFT"},'
            '{"id":"live","title":"Concert","status":"PUBLISHED"}]}',
            200,
          );
        }
        expect(request.url.path, '/api/organizer/events/live');
        return http.Response(
          '{"event":{"title":"Concert","status":"PUBLISHED","ticketTypes":'
          '[{"name":"Balcony","sold":3,"available":9,"priceKzt":2500}]}}',
          200,
        );
      }),
    )..token = 'organizer-token';
    addTearDown(api.close);

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: const [AppLocalizations.delegate],
        home: OrganizerScreen(api: api),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Dance show'), findsOneWidget);
    await tester.tap(find.widgetWithText(ChoiceChip, 'Published'));
    await tester.pumpAndSettle();
    expect(find.text('Dance show'), findsNothing);
    await tester.tap(find.text('Concert'));
    await tester.pumpAndSettle();
    expect(find.text('Balcony'), findsOneWidget);
    expect(find.text('3 sold · 9 available'), findsOneWidget);
    expect(find.text('₸2500'), findsOneWidget);
  });
}
