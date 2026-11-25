import 'package:material_ui/material_ui.dart';
import '../core/api.dart';
import '../l10n/app_localizations.dart';

String adminLabel(BuildContext context, String en, String ru, String kk) =>
    switch (Localizations.localeOf(context).languageCode) {
      'ru' => ru, 'kk' => kk, _ => en,
    };

class AdminModeration extends StatefulWidget {
  const AdminModeration({super.key, required this.api});
  final ApiClient api;
  @override
  State<AdminModeration> createState() => _AdminModerationState();
}

class _AdminModerationState extends State<AdminModeration> {
  final query = TextEditingController();
  Map<String, dynamic> results = {};
  bool busy = false;
  String? error;

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  Future<void> load({bool reports = false}) async {
    if (busy) return;
    if (!reports && query.text.trim().length < 2) return;
    setState(() { busy = true; error = null; results = {}; });
    try {
      final data = reports
          ? await widget.api.get('/api/admin/reports')
          : await widget.api.get('/api/admin/search', query: {'q': query.text.trim()});
      if (mounted) setState(() => results = data);
    } catch (e) {
      if (mounted) setState(() => error = AppLocalizations.of(context).apiError(e is ApiException ? e.code : ''));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> suspend(String group, String id) async {
    if (busy) return;
    String reason = '';
    final confirmed = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: Text(adminLabel(ctx, 'Confirm suspension', 'Подтвердить блокировку', 'Бұғаттауды растау')),
      content: TextField(onChanged: (v) => reason = v, maxLength: 500,
        decoration: InputDecoration(labelText: adminLabel(ctx, 'Reason', 'Причина', 'Себебі'))),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(adminLabel(ctx, 'Cancel', 'Отмена', 'Бас тарту'))),
        FilledButton(onPressed: () { if (reason.trim().length >= 3) Navigator.pop(ctx, true); },
          child: Text(adminLabel(ctx, 'Suspend', 'Заблокировать', 'Бұғаттау'))),
      ],
    ));
    if (!mounted || confirmed != true) return;
    setState(() { busy = true; error = null; });
    try {
      await widget.api.post('/api/admin/$group/${Uri.encodeComponent(id)}/suspend', {'reason': reason.trim()});
      if (!mounted) return;
      setState(() { busy = false; });
      await load(reports: results.containsKey('reports'));
    } catch (e) {
      if (mounted) setState(() { busy = false; error = AppLocalizations.of(context).apiError(e is ApiException ? e.code : ''); });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(adminLabel(context, 'Moderation', 'Модерация', 'Модерация'))),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      TextField(controller: query, enabled: !busy,
        decoration: InputDecoration(labelText: adminLabel(context, 'Search users, events, orders or payments', 'Поиск пользователей, событий, заказов и платежей', 'Пайдаланушыларды, іс-шараларды, тапсырыстарды және төлемдерді іздеу'))),
      FilledButton(onPressed: busy ? null : () => load(), child: Text(adminLabel(context, 'Search', 'Поиск', 'Іздеу'))),
      OutlinedButton(onPressed: busy ? null : () => load(reports: true), child: Text(adminLabel(context, 'Reported events', 'Жалобы на события', 'Іс-шараларға шағымдар'))),
      if (busy) const LinearProgressIndicator(),
      if (error != null) Text(error!),
      for (final group in ['users', 'events', 'orders', 'payments', 'reports'])
        if (results[group] is List) ...[
          Text(switch(group) {
            'users' => adminLabel(context,'Users','Пользователи','Пайдаланушылар'),
            'events' => adminLabel(context,'Events','События','Іс-шаралар'),
            'orders' => adminLabel(context,'Orders','Заказы','Тапсырыстар'),
            'payments' => adminLabel(context,'Payments','Платежи','Төлемдер'),
            _ => adminLabel(context,'Reports','Жалобы','Шағымдар'),
          }, style: Theme.of(context).textTheme.titleMedium),
          for (final row in (results[group] as List).whereType<Map>())
            Card(child: ListTile(
              title: Text('${row['name'] ?? row['title'] ?? row['reference'] ?? row['providerIntentId'] ?? row['reason'] ?? ''}'),
              subtitle: Text([row['email'], row['status'], row['details'], row['totalKzt'], row['amountKzt']].where((v) => v != null).join(' · ')),
              trailing: (group == 'users' && row['status'] != 'SUSPENDED' || group == 'events' && row['paidSalesSuspended'] != true) && row['id'] is String
                  ? TextButton(onPressed: busy ? null : () => suspend(group, row['id'] as String),
                    child: Text(adminLabel(context,'Suspend','Блокировать','Бұғаттау')))
                  : null,
            )),
        ],
    ]),
  );
}
