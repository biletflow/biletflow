import 'package:flutter_test/flutter_test.dart';
import 'package:biletflow_mobile/screens/my_tickets.dart';

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
}
