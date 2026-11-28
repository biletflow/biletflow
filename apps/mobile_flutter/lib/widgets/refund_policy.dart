import 'package:material_ui/material_ui.dart';

import '../l10n/app_localizations.dart';

String? refundBlockedReason(Object? policy, Object? startsAt) {
  if (policy == 'NO_REFUNDS') return 'REFUND_NOT_ALLOWED';

  final hours = switch (policy) {
    'UNTIL_24H_BEFORE' => 24,
    'UNTIL_48H_BEFORE' => 48,
    _ => null,
  };

  final start = DateTime.tryParse(startsAt?.toString() ?? '');
  if (hours == null || start == null) return null;

  if (DateTime.now().isAfter(start.subtract(Duration(hours: hours)))) {
    return hours == 24 ? 'REFUND_WINDOW_24H' : 'REFUND_WINDOW_48H';
  }

  return null;
}

class RefundPolicyNotice extends StatelessWidget {
  final Object? policy;
  final Object? startsAt;

  const RefundPolicyNotice({super.key, required this.policy, this.startsAt});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final lang = l10n.locale.languageCode;

    final heading = switch (lang) {
      'ru' => 'Условия возврата',
      'kk' => 'Билетті қайтару шарттары',
      _ => 'Refund policy',
    };

    final hours = switch (policy) {
      'UNTIL_24H_BEFORE' => 24,
      'UNTIL_48H_BEFORE' => 48,
      _ => null,
    };

    final blocked = refundBlockedReason(policy, startsAt);

    if (hours == null && blocked == null) {
      return const SizedBox.shrink();
    }

    final message = blocked != null
        ? l10n.apiError(blocked)
        : switch (lang) {
            'ru' =>
              'Билеты можно вернуть не позднее чем за $hours часов до начала мероприятия.',
            'kk' =>
              'Билеттерді іс-шара басталғанға дейін кемінде $hours сағат бұрын қайтаруға болады.',
            _ =>
              'Tickets can be refunded up to $hours hours before the event starts.',
          };

    return Card(
      child: ListTile(
        leading: const Icon(Icons.info_outline),
        title: Text(heading),
        subtitle: Text(message),
      ),
    );
  }
}
