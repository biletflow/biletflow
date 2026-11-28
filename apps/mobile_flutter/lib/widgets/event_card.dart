import 'package:material_ui/material_ui.dart';

import '../core/format.dart';
import '../l10n/app_localizations.dart';
import '../theme/biletflow_theme.dart';

class EventCover extends StatelessWidget {
  const EventCover({super.key, this.image, this.category});

  final Uri? image;
  final String? category;

  static Uri? resolve(Uri base, Object? value) {
    if (value is! String || value.trim().isEmpty) return null;
    final relative = Uri.tryParse(value.trim());
    final uri = relative == null ? null : base.resolveUri(relative);
    if (uri == null ||
        uri.userInfo.isNotEmpty ||
        uri.host.isEmpty ||
        (uri.scheme != 'http' && uri.scheme != 'https')) {
      return null;
    }
    return uri.scheme == 'https' || uri.origin == base.origin ? uri : null;
  }

  @override
  Widget build(BuildContext context) {
    const colors = [
      [Color(0xff7c3aed), Color(0xff4338ca)],
      [Color(0xff0284c7), Color(0xff4338ca)],
      [Color(0xff059669), Color(0xff0e7490)],
      [Color(0xffb45309), Color(0xffbe123c)],
      [Color(0xffc026d3), Color(0xffbe123c)],
      [Color(0xff475569), Color(0xff27272a)],
    ];
    var hash = 0;
    for (final char in (category ?? '').codeUnits) {
      hash = (hash * 31 + char) % 1000003;
    }
    final source = image;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors[hash % colors.length],
        ),
      ),
      child: Center(
        child: source == null
            ? const Icon(
                Icons.local_activity_outlined,
                size: 54,
                color: Colors.white38,
              )
            : SizedBox.expand(
                child: Image.network(
                  source.toString(),
                  fit: BoxFit.cover,
                  excludeFromSemantics: true,
                  errorBuilder: (_, __, ___) => const Icon(
                    Icons.local_activity_outlined,
                    size: 54,
                    color: Colors.white38,
                  ),
                ),
              ),
      ),
    );
  }
}

class EventCard extends StatelessWidget {
  const EventCard({
    super.key,
    required this.title,
    this.city,
    this.startsAt,
    this.priceLabel,
    this.onTap,
    this.category,
    this.image,
  });

  final String title;
  final String? city;
  final Object? startsAt;
  final String? priceLabel;
  final VoidCallback? onTap;
  final String? category;
  final Uri? image;

  factory EventCard.fromJson(
    Map<String, dynamic> row, {
    required String Function(Map<String, dynamic> row) priceLabel,
    VoidCallback? onTap,
    Uri? base,
  }) {
    final venue = row['venue'];
    return EventCard(
      title: '${row['title'] ?? ''}',
      city: venue is Map ? venue['city'] as String? : null,
      startsAt: row['startsAt'],
      priceLabel: priceLabel(row),
      onTap: onTap,
      category: row['category'] as String?,
      image: base == null
          ? null
          : EventCover.resolve(base, row['coverImageUrl']),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final strings = Localizations.of<AppLocalizations>(
      context,
      AppLocalizations,
    );
    final when = formatEventWhen(startsAt, context: context);
    final cityName = city == null ? '' : strings?.cityName(city!) ?? city!;
    final categoryName = category == null
        ? ''
        : strings?.categoryName(category!) ?? category!;

    Widget badge(String label, Color color) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: theme.textTheme.labelMedium?.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );

    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 132,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  EventCover(image: image, category: category),
                  Padding(
                    padding: const EdgeInsets.all(10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (categoryName.isNotEmpty)
                          Flexible(
                            child: badge(categoryName, BiletFlowColors.brand),
                          ),
                        const Spacer(),
                        if (priceLabel?.isNotEmpty == true)
                          Flexible(
                            child: badge(priceLabel!, BiletFlowColors.ink900),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleMedium,
                  ),
                  if (when.isNotEmpty || cityName.isNotEmpty)
                    const SizedBox(height: 6),
                  if (when.isNotEmpty)
                    Text(
                      when,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: BiletFlowColors.ink700,
                      ),
                    ),
                  if (cityName.isNotEmpty)
                    Text(
                      cityName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: BiletFlowColors.ink700,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
