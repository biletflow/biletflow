import 'package:biletflow_mobile/core/format.dart';
import 'package:biletflow_mobile/screens/my_tickets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('groups tickets by event identity, not title', () {
    final groups = groupTicketsByEvent([
      {'id': '1', 'event': {'id': 'a', 'title': 'Concert'}},
      {'id': '2', 'event': {'id': 'b', 'title': 'Concert'}},
      {'id': '3', 'event': {'id': 'a', 'title': 'Concert'}},
    ]);
    expect(groups.keys, ['a', 'b']);
    expect(groups['a']!.map((ticket) => ticket['id']), ['1', '3']);
  });

  test('formats assigned seats and omits general admission seat labels', () {
    expect(ticketSeat({'sectionName': 'Stalls', 'rowLabel': 'A', 'seatNumber': '3'}), 'Stalls A 3');
    expect(ticketSeat({}), '');
  });

  test('shares the localized public event page', () {
    expect(
      publicEventUrl(Uri.parse('https://biletflow.kz'), 'en', 'jazz night'),
      'https://biletflow.kz/en/events/jazz%20night',
    );
    expect(
      publicEventUrl(Uri.parse('http://10.0.2.2:3000'), 'fr', 'jazz'),
      'http://10.0.2.2:3000/ru/events/jazz',
    );
  });
}
