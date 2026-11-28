import 'package:material_ui/material_ui.dart';

/// Public event page. The site always prefixes a locale; Russian is the default.
String publicEventUrl(Uri apiBase, String locale, String slug) {
  final language = locale == 'en' || locale == 'kk' || locale == 'ru'
      ? locale
      : 'ru';
  return apiBase
      .resolve('/$language/events/${Uri.encodeComponent(slug)}')
      .toString();
}

String formatWholeNumber(int amount, String languageCode) {
  final digits = amount.abs().toString();
  final separator = languageCode == 'en' ? ',' : '\u00a0';
  final grouped = StringBuffer(amount < 0 ? '−' : '');
  for (var index = 0; index < digits.length; index++) {
    if (index > 0 && (digits.length - index) % 3 == 0) grouped.write(separator);
    grouped.write(digits[index]);
  }
  return grouped.toString();
}

String formatKzt(
  num amount, {
  String freeLabel = 'Free',
  String languageCode = 'en',
}) {
  if (amount == 0) return freeLabel;
  return '₸${formatWholeNumber(amount.round(), languageCode)}';
}

String formatEventWhen(Object? value, {BuildContext? context}) {
  if (value == null) return '';
  if (value is DateTime) {
    final local = value.toLocal();
    if (context != null) {
      final material = MaterialLocalizations.of(context);
      final date = material.formatShortDate(local);
      final time = material.formatTimeOfDay(
        TimeOfDay.fromDateTime(local),
        alwaysUse24HourFormat: true,
      );
      return '$date · $time';
    }
    String two(int n) => n.toString().padLeft(2, '0');
    return '${local.year}-${two(local.month)}-${two(local.day)} '
        '${two(local.hour)}:${two(local.minute)}';
  }
  final raw = '$value'.trim();
  if (raw.isEmpty) return '';
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return raw;
  return formatEventWhen(parsed, context: context);
}
