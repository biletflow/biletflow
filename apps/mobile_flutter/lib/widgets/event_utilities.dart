import 'dart:io';

import 'package:material_ui/material_ui.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';

class EventUtilities extends StatefulWidget {
  const EventUtilities({super.key, required this.api, required this.calendarPath, this.venue});
  final ApiClient api;
  final String calendarPath;
  final Object? venue;

  @override
  State<EventUtilities> createState() => _EventUtilitiesState();
}

class _EventUtilitiesState extends State<EventUtilities> {
  bool busy = false;

  String label(String en, String ru, String kk) =>
      switch (AppLocalizations.of(context).locale.languageCode) {
        'ru' => ru,
        'kk' => kk,
        _ => en,
      };

  Rect? get shareOrigin {
    final box = context.findRenderObject() as RenderBox?;
    return box == null || !box.hasSize ? null : box.localToGlobal(Offset.zero) & box.size;
  }

  Future<void> calendar() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final bytes = await widget.api.getBytes(widget.calendarPath, accept: 'text/calendar');
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/biletflow-event.ics');
      await file.writeAsBytes(bytes, flush: true);
      if (!mounted) return;
      await Share.shareXFiles([XFile(file.path, mimeType: 'text/calendar')], sharePositionOrigin: shareOrigin);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(label('Could not export calendar', 'Не удалось экспортировать календарь', 'Күнтізбені экспорттау мүмкін болмады'))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final venue = widget.venue;
    final location = venue is Map
        ? [venue['name'], venue['address'], venue['city'], venue['country']].whereType<String>().where((value) => value.isNotEmpty).join(', ')
        : '';
    final url = Uri.https('www.google.com', '/maps/search/', {'api': '1', 'query': location});
    return Wrap(spacing: 8, runSpacing: 8, children: [
      OutlinedButton.icon(onPressed: busy ? null : calendar, icon: const Icon(Icons.calendar_month), label: Text(label('Add to calendar', 'В календарь', 'Күнтізбеге'))),
      if (location.isNotEmpty)
        OutlinedButton.icon(
          onPressed: () async {
            await showDialog<void>(context: context, builder: (context) => AlertDialog(
              title: Text(label('Map link', 'Ссылка на карту', 'Карта сілтемесі')),
              content: SelectableText(url.toString()),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: Text(MaterialLocalizations.of(context).closeButtonLabel)),
                FilledButton(onPressed: () async {
                  Navigator.pop(context);
                  await Share.share(url.toString(), sharePositionOrigin: shareOrigin);
                }, child: Text(label('Share / open link', 'Поделиться / открыть ссылку', 'Сілтемені бөлісу / ашу'))),
              ],
            ));
          },
          icon: const Icon(Icons.map_outlined), label: Text(label('Maps', 'Карта', 'Карта')),
        ),
    ]);
  }
}
