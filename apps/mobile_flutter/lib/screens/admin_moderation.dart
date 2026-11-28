import 'dart:io';

import 'package:material_ui/material_ui.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../widgets/status_badge.dart';
import '../l10n/app_localizations.dart';

String adminLabel(BuildContext context, String en, String ru, String kk) =>
    switch (Localizations.localeOf(context).languageCode) {
      'ru' => ru,
      'kk' => kk,
      _ => en,
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
  String view = 'directory';
  String? error;

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    load(mode: 'directory');
  }

  Future<void> load({String mode = 'search'}) async {
    if (busy) return;
    if (mode == 'search' && query.text.trim().length < 2) return;
    setState(() {
      busy = true;
      error = null;
      results = {};
      view = mode;
    });
    try {
      final data = switch (mode) {
        'reports' => await widget.api.get('/api/admin/reports'),
        'directory' => await widget.api.get(
          '/api/admin/search',
          query: {'view': 'directory'},
        ),
        _ => await widget.api.get(
          '/api/admin/search',
          query: {'q': query.text.trim()},
        ),
      };
      if (mounted) setState(() => results = data);
    } catch (e) {
      if (mounted) {
        setState(
          () =>
              error = AppLocalizations.of(context)
                  .apiError(e is ApiException ? e.code : ''),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> exportOrders() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final bytes = await widget.api.getBytes(
        '/api/admin/exports/orders.csv',
        accept: 'text/csv',
      );
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/biletflow-orders.csv');
      await file.writeAsBytes(bytes, flush: true);
      try {
        if (!mounted) return;
        final box = context.findRenderObject() as RenderBox?;
        await Share.shareXFiles(
          [XFile(file.path, mimeType: 'text/csv')],
          sharePositionOrigin: box == null
              ? null
              : box.localToGlobal(Offset.zero) & box.size,
        );
      } finally {
        if (await file.exists()) await file.delete();
      }
    } catch (e) {
      if (mounted) {
        setState(
          () =>
              error = AppLocalizations.of(context)
                  .apiError(e is ApiException ? e.code : ''),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> suspend(String group, String id) async {
    if (busy) return;
    String reason = '';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          adminLabel(
            ctx,
            'Confirm suspension',
            'Подтвердить блокировку',
            'Бұғаттауды растау',
          ),
        ),
        content: TextField(
          onChanged: (v) => reason = v,
          maxLength: 500,
          decoration: InputDecoration(
            labelText: adminLabel(ctx, 'Reason', 'Причина', 'Себебі'),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(adminLabel(ctx, 'Cancel', 'Отмена', 'Бас тарту')),
          ),
          FilledButton(
            onPressed: () {
              if (reason.trim().length >= 3) Navigator.pop(ctx, true);
            },
            child: Text(
              adminLabel(ctx, 'Suspend', 'Заблокировать', 'Бұғаттау'),
            ),
          ),
        ],
      ),
    );
    if (!mounted || busy || confirmed != true) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.post(
        '/api/admin/$group/${Uri.encodeComponent(id)}/suspend',
        {'reason': reason.trim()},
      );
      if (!mounted) return;
      setState(() {
        busy = false;
      });
      await load(mode: view);
    } catch (e) {
      if (mounted) {
        setState(() {
          busy = false;
          error = AppLocalizations.of(context)
              .apiError(e is ApiException ? e.code : '');
        });
      }
    }
  }

  String tr(String en, String ru, String kk) => adminLabel(context, en, ru, kk);

  StatusBadge badge(String status, String group) {
    final l10n = AppLocalizations.of(context);
    final (label, tone) = switch (status) {
      'ACTIVE' => (tr('Active', 'Активно', 'Белсенді'), StatusTone.success),
      'PUBLISHED' => (l10n.eventStatus(status), StatusTone.success),
      'SUCCEEDED' => (l10n.orderStatus('PAID'), StatusTone.success),
      'SUSPENDED' => (
        tr('Suspended', 'Заблокировано', 'Бұғатталған'),
        StatusTone.danger,
      ),
      'DRAFT' => (l10n.eventStatus(status), StatusTone.neutral),
      'COMPLETED' => (l10n.eventStatus(status), StatusTone.info),
      'CANCELLED' => (l10n.ticketStatus(status), StatusTone.danger),
      'REFUNDED' => (l10n.ticketStatus(status), StatusTone.warning),
      'CREATED' || 'PROCESSING' || 'PENDING' => (
        tr('Pending', 'В ожидании', 'Күтілуде'),
        StatusTone.warning,
      ),
      'FAILED' => (l10n.orderStatus(status), StatusTone.danger),
      'ABANDONED' => (
        tr('Abandoned', 'Прервано', 'Тоқтатылған'),
        StatusTone.neutral,
      ),
      _ => (
        group == 'orders'
            ? l10n.orderStatus(status)
            : tr('Unavailable', 'Недоступно', 'Қолжетімсіз'),
        StatusBadge.toneForOrder(status),
      ),
    };
    return StatusBadge(label: label, tone: tone);
  }

  String roleName(Object? role) => switch (role) {
    'PLATFORM_ADMIN' => tr(
      'Platform admin',
      'Администратор платформы',
      'Платформа әкімшісі',
    ),
    'ORGANIZER' => tr('Organizer', 'Организатор', 'Ұйымдастырушы'),
    'ATTENDEE' => tr('Attendee', 'Посетитель', 'Қатысушы'),
    _ => '',
  };

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(adminLabel(context, 'Moderation', 'Модерация', 'Модерация')),
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: query,
          enabled: !busy,
          decoration: InputDecoration(
            labelText: adminLabel(
              context,
              'Search users, events, orders or payments',
              'Поиск пользователей, событий, заказов и платежей',
              'Пайдаланушыларды, іс-шараларды, тапсырыстарды және төлемдерді іздеу',
            ),
          ),
        ),
        FilledButton(
          onPressed: busy ? null : () => load(),
          child: Text(adminLabel(context, 'Search', 'Поиск', 'Іздеу')),
        ),
        OutlinedButton(
          onPressed: busy ? null : () => load(mode: 'reports'),
          child: Text(
            adminLabel(
              context,
              'Reported events',
              'Жалобы на события',
              'Іс-шараларға шағымдар',
            ),
          ),
        ),
        OutlinedButton(
          onPressed: busy ? null : () => load(mode: 'directory'),
          child: Text(
            tr(
              'User directory',
              'Список пользователей',
              'Пайдаланушылар тізімі',
            ),
          ),
        ),
        OutlinedButton(
          onPressed: busy ? null : exportOrders,
          child: Text(
            adminLabel(
              context,
              'Export orders CSV',
              'Экспорт заказов CSV',
              'Тапсырыстарды CSV экспорттау',
            ),
          ),
        ),
        if (busy) const LinearProgressIndicator(),
        if (error != null) Text(error!),
        if (!busy &&
            error == null &&
            results.isNotEmpty &&
            results.values.whereType<List>().every((items) => items.isEmpty))
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text(
              tr('No results', 'Ничего не найдено', 'Нәтиже табылмады'),
            ),
          ),
        for (final group in [
          'users',
          'events',
          'orders',
          'payments',
          'reports',
        ])
          if (results[group] case final List rows when rows.isNotEmpty) ...[
            Text(switch (group) {
              'users' => adminLabel(
                context,
                'Users',
                'Пользователи',
                'Пайдаланушылар',
              ),
              'events' => adminLabel(
                context,
                'Events',
                'События',
                'Іс-шаралар',
              ),
              'orders' => adminLabel(
                context,
                'Orders',
                'Заказы',
                'Тапсырыстар',
              ),
              'payments' => adminLabel(
                context,
                'Payments',
                'Платежи',
                'Төлемдер',
              ),
              _ => adminLabel(context, 'Reports', 'Жалобы', 'Шағымдар'),
            }, style: Theme.of(context).textTheme.titleMedium),
            for (final row in rows.whereType<Map>())
              Card(
                child: ListTile(
                  title: Text(
                    '${row['name'] ?? row['title'] ?? row['reference'] ?? row['providerIntentId'] ?? row['reason'] ?? ''}',
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        if (row['email'] != null) Text('${row['email']}'),
                        if (roleName(row['role']).isNotEmpty)
                          Text(roleName(row['role'])),
                        if (row['status'] is String)
                          badge(row['status'] as String, group),
                        if (row['details'] != null) Text('${row['details']}'),
                        if ((row['totalKzt'] ?? row['amountKzt'])
                            case final num amount)
                          Text(
                            formatKzt(
                              amount,
                              freeLabel: '₸0',
                              languageCode: Localizations.localeOf(context)
                                  .languageCode,
                            ),
                          ),
                      ],
                    ),
                  ),
                  trailing:
                      (group == 'users' && row['status'] != 'SUSPENDED' ||
                              group == 'events' &&
                                  row['paidSalesSuspended'] != true) &&
                          row['id'] is String
                      ? TextButton(
                          onPressed: busy
                              ? null
                              : () => suspend(group, row['id'] as String),
                          child: Text(
                            adminLabel(
                              context,
                              'Suspend',
                              'Блокировать',
                              'Бұғаттау',
                            ),
                          ),
                        )
                      : null,
                ),
              ),
          ],
      ],
    ),
  );
}
