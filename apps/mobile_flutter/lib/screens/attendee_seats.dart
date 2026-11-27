import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';

String seatLabel(BuildContext context, String en, String ru, String kk) =>
    switch (Localizations.localeOf(context).languageCode) {
      'ru' => ru,
      'kk' => kk,
      _ => en,
    };

class SeatSelection {
  final List<String> ids;
  final List<String> labels;
  const SeatSelection(this.ids, this.labels);
}

class AttendeeSeats extends StatefulWidget {
  const AttendeeSeats({super.key, required this.api, required this.slug, required this.limit, required this.priceKzt});
  final ApiClient api;
  final String slug;
  final int limit;
  final int priceKzt;

  @override
  State<AttendeeSeats> createState() => _AttendeeSeatsState();
}

class _AttendeeSeatsState extends State<AttendeeSeats> {
  final selected = <String, String>{};
  late Future<List<Map<String, dynamic>>> board = load();

  List<Map<String, dynamic>> rows(Object? value) =>
      (value as List? ?? []).whereType<Map<String, dynamic>>().toList();

  Future<List<Map<String, dynamic>>> load() async {
    final data = await widget.api.get('/api/events/${Uri.encodeComponent(widget.slug)}/seats');
    return rows(data['sections']);
  }

  void refresh() => setState(() {
    selected.clear();
    board = load();
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(seatLabel(context, 'Choose seats', 'Выбор мест', 'Орын таңдау')), actions: [
        IconButton(onPressed: refresh, icon: const Icon(Icons.refresh), tooltip: l10n.refresh),
      ]),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: board,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const LoadingState();
          if (snapshot.hasError) return ErrorState(message: seatLabel(context, 'Could not load seats', 'Не удалось загрузить места', 'Орындар жүктелмеді'), onRetry: refresh, retryLabel: l10n.refresh);
          final sections = snapshot.data ?? [];
          if (sections.isEmpty) return Center(child: Text(seatLabel(context, 'No seats available', 'Нет свободных мест', 'Бос орындар жоқ')));
          return ListView(padding: const EdgeInsets.all(16), children: [
            Text(seatLabel(context, 'Select up to ${widget.limit} seats. * Accessible seat.', 'Выберите до ${widget.limit} мест. * Доступное место.', '${widget.limit} орынға дейін таңдаңыз. * Бейімделген орын.')),
            const SizedBox(height: 12),
            for (final section in sections) Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${section['name']}', style: Theme.of(context).textTheme.titleMedium),
              for (final row in rows(section['rows'])) ...[
                const SizedBox(height: 8),
                Text('${seatLabel(context, 'Row', 'Ряд', 'Қатар')} ${row['label']}'),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final seat in rows(row['seats']))
                    ChoiceChip(
                      label: Text('${seat['number']}${seat['isAccessible'] == true ? ' *' : ''}'),
                      selected: selected.containsKey(seat['id']),
                      onSelected: (seat['status'] != null && seat['status'] != 'AVAILABLE') || (!selected.containsKey(seat['id']) && selected.length >= widget.limit) ? null : (value) {
                        setState(() {
                          final id = seat['id'] as String;
                          if (value) {
                            selected[id] = '${section['name']} ${row['label']} ${seat['number']}';
                          } else {
                            selected.remove(id);
                          }
                        });
                      },
                    ),
                ]),
              ],
            ]))),
          ]);
        },
      ),
      bottomNavigationBar: SafeArea(child: Padding(padding: const EdgeInsets.all(16), child: FilledButton(
        onPressed: selected.isEmpty ? null : () => Navigator.pop(context, SeatSelection(selected.keys.toList(), selected.values.toList())),
        child: Text('${l10n.continueWithTickets(selected.length)} · ${l10n.money(selected.length * widget.priceKzt)}'),
      ))),
    );
  }
}
