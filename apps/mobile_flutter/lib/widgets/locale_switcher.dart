import 'package:material_ui/material_ui.dart';

import '../l10n/app_localizations.dart';
import '../l10n/locale_controller.dart';

class LocaleSwitcher extends StatelessWidget {
  final LocaleController controller;
  const LocaleSwitcher({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PopupMenuButton<String>(
      tooltip: l10n.language,
      initialValue: controller.locale.languageCode,
      onSelected: (code) => controller.setLocale(Locale(code)),
      itemBuilder: (_) => const [
        PopupMenuItem(value: 'en', child: Text('English')),
        PopupMenuItem(value: 'ru', child: Text('Русский')),
        PopupMenuItem(value: 'kk', child: Text('Қазақша')),
      ],
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.language),
            const SizedBox(width: 4),
            Text(controller.locale.languageCode.toUpperCase()),
          ],
        ),
      ),
    );
  }
}
