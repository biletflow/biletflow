/// Whole-tenge display helpers shared by attendee screens.
String formatKzt(num amount, {String freeLabel = 'Free'}) {
  if (amount == 0) return freeLabel;
  return '₸${amount.round()}';
}

/// Compact ISO / DateTime display without inventing a timezone library.
String formatEventWhen(Object? value) {
  if (value == null) return '';
  if (value is DateTime) {
    final local = value.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${local.year}-${two(local.month)}-${two(local.day)} '
        '${two(local.hour)}:${two(local.minute)}';
  }
  final raw = '$value'.trim();
  if (raw.isEmpty) return '';
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return raw;
  return formatEventWhen(parsed);
}
