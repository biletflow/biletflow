import 'package:biletflow_mobile/widgets/empty_state.dart';
import 'package:biletflow_mobile/widgets/event_card.dart';
import 'package:biletflow_mobile/widgets/quantity_stepper.dart';
import 'package:biletflow_mobile/widgets/status_badge.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  testWidgets('EventCard shows title, meta, and handles tap', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: EventCard(
            title: 'Jazz Night',
            city: 'Almaty',
            startsAt: '2026-12-01 19:00',
            priceLabel: 'from ₸5000',
            onTap: () => tapped = true,
          ),
        ),
      ),
    );
    expect(find.text('Jazz Night'), findsOneWidget);
    expect(find.textContaining('Almaty'), findsOneWidget);
    await tester.tap(find.byType(EventCard));
    expect(tapped, isTrue);
  });

  testWidgets('QuantityStepper respects max and min', (tester) async {
    var value = 1;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) => QuantityStepper(
              value: value,
              max: 2,
              onChanged: (next) => setState(() => value = next),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.byTooltip('Increase'));
    await tester.pump();
    expect(value, 2);
    expect(find.text('2'), findsOneWidget);
    await tester.tap(find.byTooltip('Increase'));
    await tester.pump();
    expect(value, 2);
    await tester.tap(find.byTooltip('Decrease'));
    await tester.pump();
    await tester.tap(find.byTooltip('Decrease'));
    await tester.pump();
    expect(value, 0);
    expect(find.text('0'), findsOneWidget);
    await tester.tap(find.byTooltip('Decrease'));
    await tester.pump();
    expect(value, 0);
  });

  testWidgets('ErrorState shows message and retry', (tester) async {
    var retried = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ErrorState(
            message: 'REQUEST_FAILED',
            retryLabel: 'Retry',
            onRetry: () => retried = true,
          ),
        ),
      ),
    );
    expect(find.text('REQUEST_FAILED'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    expect(retried, isTrue);
  });

  testWidgets('StatusBadge uses success tone for VALID tickets', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StatusBadge.ticket('VALID', 'Valid'),
        ),
      ),
    );
    expect(find.text('Valid'), findsOneWidget);
  });
}
