import 'package:material_ui/material_ui.dart';
import '../core/api.dart';
import '../l10n/app_localizations.dart';
import 'admin_moderation.dart';

class OrganizerOverview extends StatefulWidget {
  const OrganizerOverview({super.key, required this.api, required this.eventId});
  final ApiClient api;
  final String eventId;
  @override
  State<OrganizerOverview> createState() => _OrganizerOverviewState();
}

class _OrganizerOverviewState extends State<OrganizerOverview> {
  final from = TextEditingController();
  final to = TextEditingController();
  final action = TextEditingController();
  late Future<List<Map<String, dynamic>>> data = load();
  String? type;
  String get path => '/api/organizer/events/${Uri.encodeComponent(widget.eventId)}';
  Future<List<Map<String, dynamic>>> load() => Future.wait([
    widget.api.get('$path/overview', query: {'from': from.text, 'to': to.text}),
    widget.api.get('$path/history', query: {'action': action.text}),
  ]);
  @override
  void dispose() {
    from.dispose(); to.dispose(); action.dispose(); super.dispose();
  }
  void refresh() => setState(() => data = load());
  String tr(String en, String ru, String kk) => adminLabel(context,en,ru,kk);
  Widget line(String label, Object? value) => ListTile(title: Text(label), trailing: Text('${value ?? ""}'));
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    String money(Object? v) => v is int ? l10n.money(v) : '';
    return Scaffold(
      appBar: AppBar(title: Text(tr('Event overview','Обзор мероприятия','Іс-шара шолуы'))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        TextField(controller: from, decoration: InputDecoration(labelText: tr('From (YYYY-MM-DD)','С (ГГГГ-ММ-ДД)','Бастап (ЖЖЖЖ-АА-КК)'))),
        TextField(controller: to, decoration: InputDecoration(labelText: tr('To (YYYY-MM-DD)','По (ГГГГ-ММ-ДД)','Дейін (ЖЖЖЖ-АА-КК)'))),
        TextField(controller: action, decoration: InputDecoration(labelText: tr('Audit action (optional)','Действие аудита (необязательно)','Аудит әрекеті (міндетті емес)'))),
        FilledButton(onPressed: refresh, child: Text(l10n.refresh)),
        FutureBuilder(future: data, builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError || !snapshot.hasData) return Text(l10n.apiError(snapshot.error is ApiException ? (snapshot.error as ApiException).code : ''));
          final overview = snapshot.data![0];
          final inventory = overview['inventory'] as Map;
          final attendance = overview['attendance'] as Map;
          final totals = overview['totals'] as Map;
          final types = (overview['ticketTypes'] as List).whereType<Map>().toList();
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            line(tr('Capacity','Вместимость','Сыйымдылық'), inventory['capacity']),
            line(tr('Sold','Продано','Сатылды'), inventory['sold']),
            line(tr('Available','Доступно','Қолжетімді'), inventory['available']),
            line(tr('Reserved','Забронировано','Брондалды'), inventory['reserved']),
            line(tr('Refunded tickets','Возвращено билетов','Қайтарылған билеттер'), inventory['refunded']),
            line(tr('Checked in','Прошли контроль','Кіргендер'), "${attendance['checkedIn']} / ${attendance['registered']}"),
            line(tr('Absent','Не пришли','Кірмегендер'), attendance['absent']),
            const Divider(),
            Text(tr('Simulated sales (KZT)','Продажи (симуляция, KZT)','Сынақ сатылымдары (KZT)')),
            for (final (key,label) in [
              ('gross',tr('Gross sales','Валовые продажи','Жалпы сатылым')),
              ('discounts',tr('Discounts','Скидки','Жеңілдіктер')),
              ('fees',tr('Fees','Комиссии','Комиссиялар')),
              ('refunds',tr('Refunds','Возвраты','Қайтарымдар')),
              ('net',tr('Estimated net revenue','Чистая выручка','Таза табыс')),
            ]) line(label,money(totals[key])),
            const Divider(),
            Text(tr('Sales over time','Продажи по датам','Күндер бойынша сатылым')),
            for (final row in (overview['days'] as List).whereType<Map>()) line('${row['day']}',money(row['amountKzt'])),
            const Divider(),
            Text(tr('Ticket types','Типы билетов','Билет түрлері')),
            Wrap(spacing: 8, children: [
              ChoiceChip(label: Text(tr('All','Все','Барлығы')), selected: type == null, onSelected: (_) => setState(() => type = null)),
              for (final row in types) ChoiceChip(label: Text('${row['name']}'), selected: type == row['id'], onSelected: (_) => setState(() => type = row['id'] as String)),
            ]),
            for (final row in types.where((r) => type == null || r['id'] == type))
              line('${row['name']} (${row['issued']})',money(row['totalKzt'])),
            const Divider(),
            Text(tr('Campaigns','Кампании','Науқандар')),
            for (final row in (overview['campaigns'] as List).whereType<Map>()) line('${row['name']} (${row['redeemed']})',money(row['net'] ?? 0)),
            const Divider(),
            Text(tr('Activity history','История действий','Әрекет тарихы')),
            for (final row in (snapshot.data![1]['entries'] as List).whereType<Map>())
              ListTile(title: Text('${row['action']}'), subtitle: Text("${row['createdAt']}\n${row['description']}\n${row['actorUserId'] ?? ''}")),
          ]);
        }),
      ]),
    );
  }
}
