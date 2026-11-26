import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../widgets/empty_state.dart';
import '../l10n/app_localizations.dart';
import 'admin_moderation.dart';

class OrganizerOverview extends StatefulWidget {
  const OrganizerOverview({
    super.key,
    required this.api,
    required this.eventId,
  });
  final ApiClient api;
  final String eventId;
  @override
  State<OrganizerOverview> createState() => _OrganizerOverviewState();
}

class _OrganizerOverviewState extends State<OrganizerOverview> {
  DateTimeRange? period;
  String? action;
  late Future<List<Map<String, dynamic>>> data;
  String? type;
  String get path =>
      '/api/organizer/events/${Uri.encodeComponent(widget.eventId)}';
  String dateKey(DateTime value) => value.toIso8601String().split('T').first;
  Future<List<Map<String, dynamic>>> load() => Future.wait([
    widget.api.get(
      '$path/overview',
      query: {
        if (period case final selected?) 'from': dateKey(selected.start),
        if (period case final selected?) 'to': dateKey(selected.end),
      },
    ),
    widget.api.get(
      '$path/history',
      query: {if (action != null) 'action': action!},
    ),
  ]);

  @override
  void initState() {
    super.initState();
    data = load();
  }

  Future<void> choosePeriod() async {
    final selected = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2000),
      lastDate: DateTime(2200),
      initialDateRange: period,
    );
    if (!mounted || selected == null) return;
    period = selected;
    refresh();
  }

  void refresh() => setState(() => data = load());
  String tr(String en, String ru, String kk) => adminLabel(context, en, ru, kk);
  Widget line(String label, Object? value) =>
      ListTile(title: Text(label), trailing: Text('${value ?? ""}'));
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    String money(Object? v) => v is num
        ? '${formatWholeNumber(v.round(), l10n.locale.languageCode)} KZT'
        : '—';
    final formatter = MaterialLocalizations.of(context);
    final allDates = tr('All dates', 'Все даты', 'Барлық күн');
    final all = tr('All actions', 'Все действия', 'Барлық әрекет');
    final noData = tr(
      'No data for this selection',
      'Нет данных для выбранных параметров',
      'Таңдалған параметрлер бойынша дерек жоқ',
    );
    final periodLabel = switch (period) {
      final selected? =>
        '${formatter.formatShortDate(selected.start)} – ${formatter.formatShortDate(selected.end)}',
      null => allDates,
    };
    Widget metric(String label, Object? value) => SizedBox(
      width: 155,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label),
              const SizedBox(height: 4),
              Text(
                '${value ?? "—"}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ],
          ),
        ),
      ),
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('Event overview', 'Обзор мероприятия', 'Іс-шара шолуы')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Wrap(
            spacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: choosePeriod,
                icon: const Icon(Icons.date_range_outlined),
                label: Text(periodLabel),
              ),
              if (period != null)
                TextButton(
                  onPressed: () {
                    period = null;
                    refresh();
                  },
                  child: Text(allDates),
                ),
            ],
          ),
          FilledButton(onPressed: refresh, child: Text(l10n.refresh)),
          FutureBuilder(
            future: data,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Padding(
                  padding: EdgeInsets.all(16),
                  child: LinearProgressIndicator(),
                );
              }
              if (snapshot.hasError || !snapshot.hasData) {
                return ErrorState(
                  message: l10n.apiError(
                    snapshot.error is ApiException
                        ? (snapshot.error as ApiException).code
                        : '',
                  ),
                  onRetry: refresh,
                  retryLabel: l10n.refresh,
                );
              }
              final overview = snapshot.data![0];
              final inventory = overview['inventory'] as Map;
              final attendance = overview['attendance'] as Map;
              final totals = overview['totals'] as Map;
              final types = (overview['ticketTypes'] as List)
                  .whereType<Map>()
                  .toList();
              final days = (overview['days'] as List).whereType<Map>().toList();
              final actions =
                  (snapshot.data![1]['actions'] as List?)
                      ?.whereType<String>()
                      .toList() ??
                  <String>[];
              final selectedAction = action;
              final history = (snapshot.data![1]['entries'] as List)
                  .whereType<Map>()
                  .toList();
              final peak = days.fold<num>(0, (max, row) {
                final value = (row['amountKzt'] as num?)?.abs() ?? 0;
                return value > max ? value : max;
              });
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      metric(
                        tr('Capacity', 'Вместимость', 'Сыйымдылық'),
                        inventory['capacity'],
                      ),
                      metric(
                        tr('Sold', 'Продано', 'Сатылды'),
                        inventory['sold'],
                      ),
                      metric(
                        tr('Available', 'Доступно', 'Қолжетімді'),
                        inventory['available'],
                      ),
                      metric(
                        tr('Reserved', 'Забронировано', 'Брондалды'),
                        inventory['reserved'],
                      ),
                      metric(
                        tr(
                          'Refunded tickets',
                          'Возвращено билетов',
                          'Қайтарылған билеттер',
                        ),
                        inventory['refunded'],
                      ),
                      metric(
                        tr('Checked in', 'Прошли контроль', 'Кіргендер'),
                        "${attendance['checkedIn']} / ${attendance['registered']}",
                      ),
                      metric(
                        tr('Absent', 'Не пришли', 'Кірмегендер'),
                        attendance['absent'],
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      tr(
                        'Sold counts inventory. Expected attendance counts valid or checked-in tickets.',
                        'Продажи учитываются по запасам, ожидаемая посещаемость — по действительным и использованным билетам.',
                        'Сатылым билет қорынан, ал күтілетін қатысу жарамды және тіркелген билеттерден есептеледі.',
                      ),
                    ),
                  ),
                  const Divider(),
                  Text(
                    tr(
                      'Simulated sales (KZT)',
                      'Продажи (симуляция, KZT)',
                      'Сынақ сатылымдары (KZT)',
                    ),
                  ),
                  for (final (key, label) in [
                    (
                      'gross',
                      tr('Gross sales', 'Валовые продажи', 'Жалпы сатылым'),
                    ),
                    ('discounts', tr('Discounts', 'Скидки', 'Жеңілдіктер')),
                    ('fees', tr('Fees', 'Комиссии', 'Комиссиялар')),
                    ('refunds', tr('Refunds', 'Возвраты', 'Қайтарымдар')),
                    (
                      'net',
                      tr(
                        'Estimated net revenue',
                        'Чистая выручка',
                        'Таза табыс',
                      ),
                    ),
                  ])
                    line(label, money(totals[key])),
                  const Divider(),
                  Text(
                    tr(
                      'Sales over time',
                      'Продажи по датам',
                      'Күндер бойынша сатылым',
                    ),
                  ),
                  if (days.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: Text(noData),
                    ),
                  for (final row in days)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                formatter.formatShortDate(
                                  DateTime.parse(row['day'] as String),
                                ),
                              ),
                              Text(money(row['amountKzt'])),
                            ],
                          ),
                          const SizedBox(height: 4),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: LinearProgressIndicator(
                              value: peak == 0
                                  ? 0
                                  : ((row['amountKzt'] as num?)?.abs() ?? 0) /
                                        peak,
                              minHeight: 8,
                            ),
                          ),
                        ],
                      ),
                    ),
                  const Divider(),
                  Text(tr('Ticket types', 'Типы билетов', 'Билет түрлері')),
                  Wrap(
                    spacing: 8,
                    children: [
                      ChoiceChip(
                        label: Text(tr('All', 'Все', 'Барлығы')),
                        selected: type == null,
                        onSelected: (_) => setState(() => type = null),
                      ),
                      for (final row in types)
                        ChoiceChip(
                          label: Text('${row['name']}'),
                          selected: type == row['id'],
                          onSelected: (_) =>
                              setState(() => type = row['id'] as String),
                        ),
                    ],
                  ),
                  for (final row in types.where(
                    (r) => type == null || r['id'] == type,
                  ))
                    line(
                      '${row['name']} (${row['issued']})',
                      money(row['totalKzt']),
                    ),
                  const Divider(),
                  Text(tr('Campaigns', 'Кампании', 'Науқандар')),
                  for (final row
                      in (overview['campaigns'] as List).whereType<Map>())
                    line(
                      '${row['name']} (${row['redeemed']})',
                      money(row['net'] ?? 0),
                    ),
                  const Divider(),
                  Text(
                    tr('Activity history', 'История действий', 'Әрекет тарихы'),
                  ),
                  DropdownButtonFormField<String>(
                    key: ValueKey(selectedAction),
                    initialValue: selectedAction ?? '',
                    decoration: InputDecoration(
                      labelText: tr(
                        'Audit action',
                        'Действие аудита',
                        'Аудит әрекеті',
                      ),
                    ),
                    isExpanded: true,
                    items: [
                      DropdownMenuItem(value: '', child: Text(all)),
                      for (final item in {
                        ...actions,
                        if (selectedAction != null) selectedAction,
                      })
                        DropdownMenuItem(
                          value: item,
                          child: Text(
                            item.replaceAll('.', ' · ').replaceAll('_', ' '),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: (next) {
                      action = next == '' ? null : next;
                      refresh();
                    },
                  ),
                  if (history.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(noData),
                    ),
                  for (final row in history)
                    ListTile(
                      title: Text('${row['description']}'),
                      subtitle: Text(
                        formatEventWhen(row['createdAt'], context: context),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
