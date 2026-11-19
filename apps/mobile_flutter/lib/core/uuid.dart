import 'dart:math';

/// RFC 4122 version-4 UUID for checkout idempotency keys.
String randomUuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  String hex(int value) => value.toRadixString(16).padLeft(2, '0');
  final parts = bytes.map(hex).join();
  return '${parts.substring(0, 8)}-${parts.substring(8, 12)}-'
      '${parts.substring(12, 16)}-${parts.substring(16, 20)}-${parts.substring(20)}';
}
