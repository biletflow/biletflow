import 'dart:convert';

import 'package:biletflow_mobile/core/api.dart';
import 'package:biletflow_mobile/l10n/app_localizations.dart';
import 'package:biletflow_mobile/screens/organizer_editor.dart';
import 'package:biletflow_mobile/screens/organizer_overview.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

Widget app(Widget body) => MaterialApp(
  locale: const Locale('en'),
  supportedLocales: AppLocalizations.supportedLocales,
  localizationsDelegates: [
    AppLocalizations.delegate,
    ...GlobalMaterialLocalizations.delegates,
  ],
  home: body,
);

void main() {
  testWidgets(
    'event editor preserves category, visibility, venue and UTC instants',
    (tester) async {
      tester.view.physicalSize = const Size(800, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = ApiClient(
        'https://example.test',
        client: MockClient((request) async {
          expect(request.url.path, '/api/organizer/venues');
          return http.Response(
            jsonEncode({
              'venues': [
                {
                  'id': 'v1',
                  'city': 'Almaty',
                  'name': 'Main Hall',
                  'address': 'Test address',
                },
              ],
            }),
            200,
          );
        }),
      );
      addTearDown(api.close);
      Map<String, dynamic>? saved;
      await tester.pumpWidget(
        app(
          OrganizerEditor(
            title: 'Edit event',
            eventApi: api,
            fields: const [
              (
                key: 'category',
                label: 'Category',
                required: false,
                number: false,
              ),
              (
                key: 'visibility',
                label: 'Visibility',
                required: true,
                number: false,
              ),
              (key: 'venueId', label: 'Venue', required: false, number: false),
              (key: 'startsAt', label: 'Starts', required: true, number: false),
              (key: 'endsAt', label: 'Ends', required: true, number: false),
            ],
            initial: const {
              'title': 'Test event',
              'category': 'Film',
              'visibility': 'PRIVATE',
              'venueId': 'v1',
              'timezone': 'Asia/Almaty',
              'startsAt': '2026-11-27T12:00:00Z',
              'endsAt': '2026-11-27T13:00:00Z',
            },
            save: (payload) async => saved = payload,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Film'), findsOneWidget);
      expect(find.text('Private'), findsOneWidget);
      expect(find.text('Main Hall · Almaty'), findsOneWidget);
      expect(find.textContaining('17:00'), findsOneWidget);
      final starts = find.widgetWithText(ListTile, 'Starts');
      await tester.tap(starts);
      await tester.pumpAndSettle();
      expect(find.byType(DatePickerDialog), findsOneWidget);
      Navigator.of(tester.element(find.byType(DatePickerDialog))).pop();
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.widgetWithText(FilledButton, 'Save'));
      await tester.tap(find.widgetWithText(FilledButton, 'Save'));
      await tester.pumpAndSettle();
      expect(saved, containsPair('startsAt', '2026-11-27T12:00:00Z'));
      expect(saved, containsPair('visibility', 'PRIVATE'));
      expect(saved, containsPair('venueId', 'v1'));
    },
  );

  testWidgets(
    'overview loads immediately and formats zero revenue as currency',
    (tester) async {
      final paths = <String>[];
      final api = ApiClient(
        'https://example.test',
        client: MockClient((request) async {
          paths.add(request.url.path);
          return http.Response(
            request.url.path.endsWith('/overview')
                ? '{"inventory":{},"attendance":{"checkedIn":0,"registered":0},"totals":{"gross":0},"ticketTypes":[],"days":[],"campaigns":[]}'
                : '{"entries":[],"actions":["event.published"]}',
            200,
          );
        }),
      );
      addTearDown(api.close);
      await tester.pumpWidget(
        app(OrganizerOverview(api: api, eventId: 'test')),
      );
      await tester.pumpAndSettle();
      expect(
        paths,
        unorderedEquals([
          '/api/organizer/events/test/overview',
          '/api/organizer/events/test/history',
        ]),
      );
      await tester.scrollUntilVisible(find.text('0 KZT'), 150);
      expect(find.text('0 KZT'), findsOneWidget);
      expect(find.text('Free'), findsNothing);
    },
  );
}
