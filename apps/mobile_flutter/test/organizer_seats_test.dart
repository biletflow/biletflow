import 'package:flutter_test/flutter_test.dart';
import '../lib/screens/organizer_seats.dart';

void main() {
  test('validates seat labels and rejects duplicates', () {
    expect(parseSeatNumbers('1, 2, VIP-3'), ['1', '2', 'VIP-3']);
    expect(parseSeatNumbers('1,1'), isNull);
    expect(parseSeatNumbers('1,'), isNull);
    expect(parseSeatNumbers(''), isNull);
    expect(parseSeatNumbers(List.generate(201, (i) => '$i').join(',')), isNull);
    expect(parseSeatNumbers(List.filled(21, 'a').join()), isNull);
  });

  test('only available seats can be deleted', () {
    expect(canDeleteSeat({'status': 'AVAILABLE'}), isTrue);
    for (final status in ['HELD', 'SOLD', 'UNAVAILABLE']) {
      expect(canDeleteSeat({'status': status}), isFalse);
    }
    expect(canDeleteSeat({}), isFalse);
  });
}
