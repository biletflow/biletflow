import 'package:material_ui/material_ui.dart';

import '../core/format.dart';
import '../theme/biletflow_theme.dart';

class EventCard extends StatelessWidget {
  final String title;
  final String? city;
  final String? startsAt;
  final String? priceLabel;
  final VoidCallback? onTap;
  const EventCard({
    super.key,
    required this.title,
    this.city,
    this.startsAt,
    this.priceLabel,
    this.onTap,
  });

  factory EventCard.fromJson(
    Map<String, dynamic> row, {
    required String Function(Map<String, dynamic> row) priceLabel,
    VoidCallback? onTap,
  }) {
    final venue = row['venue'];
    return EventCard(
      title: '${row['title'] ?? ''}',
      city: venue is Map ? '${venue['city'] ?? ''}' : null,
      startsAt: formatEventWhen(row['startsAt']),
      priceLabel: priceLabel(row),
      onTap: onTap,
    );
  }

  @override
  Widget build(BuildContext context) {
    final subtitle = [
      if (city != null && city!.isNotEmpty) city!,
      if (startsAt != null && startsAt!.isNotEmpty) startsAt!,
      if (priceLabel != null && priceLabel!.isNotEmpty) priceLabel!,
    ].join(' · ');
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        title: Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: BiletFlowColors.ink900,
                fontWeight: FontWeight.w700,
              ),
        ),
        subtitle: subtitle.isEmpty
            ? null
            : Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: BiletFlowColors.ink600,
                      ),
                ),
              ),
        trailing: onTap == null
            ? null
            : const Icon(Icons.chevron_right, color: BiletFlowColors.brand),
        onTap: onTap,
      ),
    );
  }
}
