import 'dart:convert';

import 'package:biletflow_mobile/core/api.dart';
import 'package:biletflow_mobile/l10n/app_localizations.dart';
import 'package:biletflow_mobile/screens/admin_activations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  for (final action in ['Approve', 'Reject']) {
    testWidgets('$action refreshes the queue without an error', (tester) async {
      var reviewed = false;
      final api = ApiClient(
        'https://example.test',
        client: MockClient((request) async {
          if (request.method == 'POST') {
            expect(request.url.path, '/api/admin/activations/demo/review');
            expect(jsonDecode(request.body), {
              'decision': action.toUpperCase(),
            });
            reviewed = true;
            return http.Response('{}', 200);
          }
          expect(request.url.path, '/api/admin/activations');
          return http.Response(
            reviewed
                ? '{"activations":[]}'
                : '{"activations":[{"id":"demo","event":{"title":"Test event"},'
                      '"organizer":{"name":"Test organizer"}}]}',
            200,
          );
        }),
      );
      addTearDown(api.close);
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [AppLocalizations.delegate],
          home: AdminActivations(api: api),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Refresh'));
      await tester.pumpAndSettle();
      await tester.tap(find.text(action));
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text(action),
        ),
      );
      await tester.pumpAndSettle();
      expect(reviewed, isTrue);
      expect(find.text('No pending reviews'), findsOneWidget);
      expect(find.byType(SnackBar), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }
}
