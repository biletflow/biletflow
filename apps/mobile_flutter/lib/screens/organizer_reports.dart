import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';
import 'admin_moderation.dart';

class OrganizerReports extends StatefulWidget {
  const OrganizerReports({super.key, required this.api, required this.eventId});
  final ApiClient api;
  final String eventId;

  @override
  State<OrganizerReports> createState() => _OrganizerReportsState();
}

class _OrganizerReportsState extends State<OrganizerReports> {
  late final id = Uri.encodeComponent(widget.eventId);
  late var attendance = widget.api.get('/api/mobile/events/$id/stats');
  late var campaigns = widget.api.get('/api/organizer/events/$id/campaigns');

  Future<void> createCampaign(bool percent) async {
    try {
      final result = await widget.api.get('/api/organizer/events/$id');
      if (!mounted) return;
      final event = result['event'] as Map;
      final types = (event['ticketTypes'] as List? ?? [])
          .whereType<Map>()
          .toList();
      final saved = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => _CampaignSettings(
            api: widget.api,
            eventId: id,
            types: types,
            percent: percent,
          ),
        ),
      );
      if (mounted && saved == true) {
        setState(() {
          campaigns = widget.api.get('/api/organizer/events/$id/campaigns');
        });
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            AppLocalizations.of(context)
                .apiError(error is ApiException ? error.code : ''),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(AppLocalizations.of(context).eventReports)),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          AppLocalizations.of(context).attendance,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        _ReportResult(
          data: attendance,
          retry: () => setState(() {
            attendance = widget.api.get('/api/mobile/events/$id/stats');
          }),
          content: (stats) => ListTile(
            title: Text(
              AppLocalizations.of(context)
                  .checkedInCount(stats['checkedIn'], stats['registered']),
            ),
          ),
        ),
        Text(
          AppLocalizations.of(context).campaigns,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        Wrap(
          spacing: 8,
          children: [
            OutlinedButton(
              onPressed: () => createCampaign(true),
              child: Text(
                adminLabel(
                  context,
                  'New % campaign',
                  'Новая кампания %',
                  'Жаңа % науқан',
                ),
              ),
            ),
            OutlinedButton(
              onPressed: () => createCampaign(false),
              child: Text(
                adminLabel(
                  context,
                  'New KZT campaign',
                  'Новая кампания KZT',
                  'Жаңа KZT науқан',
                ),
              ),
            ),
          ],
        ),
        _ReportResult(
          data: campaigns,
          retry: () => setState(() {
            campaigns = widget.api.get('/api/organizer/events/$id/campaigns');
          }),
          content: (data) {
            final rows = data['campaigns'] as List? ?? const [];
            if (rows.isEmpty) {
              return EmptyState(
                title: AppLocalizations.of(context).noCampaigns,
              );
            }
            return Column(
              children: [
                for (final row in rows.whereType<Map<String, dynamic>>())
                  ListTile(
                    title: Text('${row['name']}'),
                    subtitle: Text(
                      AppLocalizations.of(context)
                          .campaignSubtitle(row['status'], row['redeemed']),
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () async {
                      final changed = await Navigator.push<bool>(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              _CampaignReport(api: widget.api, campaign: row),
                        ),
                      );
                      if (mounted && changed == true) {
                        setState(() {
                          campaigns = widget.api.get(
                            '/api/organizer/events/$id/campaigns',
                          );
                        });
                      }
                    },
                  ),
              ],
            );
          },
        ),
      ],
    ),
  );
}

class _CampaignReport extends StatefulWidget {
  const _CampaignReport({required this.api, required this.campaign});
  final ApiClient api;
  final Map<String, dynamic> campaign;

  @override
  State<_CampaignReport> createState() => _CampaignReportState();
}

class _CampaignReportState extends State<_CampaignReport> {
  late final path =
      '/api/organizer/campaigns/${Uri.encodeComponent(widget.campaign['id'] as String)}';
  late var report = widget.api.get('$path/report');
  late var qr = loadQr();

  late final campaign = widget.campaign;
  bool saving = false;

  Future<void> editCampaign() async {
    if (saving) return;
    setState(() => saving = true);
    try {
      final eventId = Uri.encodeComponent(campaign['eventId'] as String);
      final result = await widget.api.get('/api/organizer/events/$eventId');
      if (!mounted) return;
      final event = result['event'] as Map;
      final types = (event['ticketTypes'] as List? ?? [])
          .whereType<Map>()
          .toList();
      final changed = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => _CampaignSettings(
            api: widget.api,
            eventId: eventId,
            types: types,
            percent: campaign['discountType'] == 'PERCENT',
            campaign: campaign,
          ),
        ),
      );
      if (mounted && changed == true) Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            AppLocalizations.of(context)
                .apiError(error is ApiException ? error.code : ''),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<Uint8List> loadQr() async => Uint8List.fromList(
    await widget.api.getBytes('$path/qr.png', accept: 'image/png'),
  );

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text('${campaign['name']}'),
        actions: [
          IconButton(
            onPressed: saving ? null : editCampaign,
            tooltip: l10n.editCampaign,
            icon: const Icon(Icons.edit),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (widget.campaign['promoCode'] case final String code)
            SelectableText(code),
          _ReportResult(
            data: report,
            retry: () => setState(() {
              report = widget.api.get('$path/report');
            }),
            content: (result) {
              final row = result['report'] as Map;
              return Column(
                children: [
                  ListTile(
                    title: Text(l10n.paidOrders),
                    trailing: Text('${row['orders']}'),
                  ),
                  ListTile(
                    title: Text(l10n.reportTickets),
                    trailing: Text('${row['tickets']}'),
                  ),
                  ListTile(
                    title: Text(l10n.redemptions),
                    trailing: Text('${row['redemptions']}'),
                  ),
                  for (final (key, label) in [
                    ('grossKzt', l10n.grossSales),
                    ('discountKzt', l10n.discounts),
                    ('netKzt', l10n.netSales),
                  ])
                    ListTile(
                      title: Text(label),
                      trailing: Text(
                        (row[key] as int) == 0
                            ? '0 KZT'
                            : l10n.money(row[key] as int),
                      ),
                    ),
                ],
              );
            },
          ),
          Text(l10n.campaignQr),
          FutureBuilder(
            future: qr,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const LoadingState();
              }
              if (snapshot.hasError || !snapshot.hasData) {
                return _reportError(
                  context,
                  snapshot.error,
                  () => setState(() {
                    qr = loadQr();
                  }),
                );
              }
              return Image.memory(
                snapshot.data!,
                height: 200,
                fit: BoxFit.contain,
              );
            },
          ),
        ],
      ),
    );
  }
}

class _CampaignSettings extends StatefulWidget {
  const _CampaignSettings({
    required this.api,
    required this.eventId,
    required this.types,
    required this.percent,
    this.campaign,
  });
  final ApiClient api;
  final String eventId;
  final List<Map> types;
  final bool percent;
  final Map<String, dynamic>? campaign;

  @override
  State<_CampaignSettings> createState() => _CampaignSettingsState();
}

class _CampaignSettingsState extends State<_CampaignSettings> {
  final form = GlobalKey<FormState>();
  late final fields = {
    for (final key in [
      'name',
      'discountValue',
      'maxRedemptions',
      'perUserLimit',
      'startsAt',
      'endsAt',
    ])
      key: TextEditingController(
        text: '${widget.campaign?[key] ?? (key == 'perUserLimit' ? 1 : '')}',
      ),
  };
  late final selected = (widget.campaign?['ticketTypeIds'] as List? ?? [])
      .whereType<String>()
      .toSet();
  late bool active = widget.campaign?['status'] != 'DISABLED';
  bool busy = false;
  String? error;
  bool get editing => widget.campaign != null;
  String tr(String en, String ru, String kk) => adminLabel(context, en, ru, kk);
  String value(String key) => fields[key]!.text.trim();

  @override
  void dispose() {
    for (final controller in fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    if (busy || !form.currentState!.validate()) return;
    final start = DateTime.tryParse(value('startsAt'));
    final end = DateTime.tryParse(value('endsAt'));
    if (start != null && end != null && !end.isAfter(start)) {
      setState(
        () => error = tr(
          'End must be after start',
          'Конец должен быть позже начала',
          'Аяқталуы басталуынан кейін болуы керек',
        ),
      );
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final body = <String, dynamic>{
        'name': value('name'),
        'perUserLimit': int.parse(value('perUserLimit')),
        'ticketTypeIds': selected.toList(),
        if (editing) 'status': active ? 'ACTIVE' : 'DISABLED',
        if (!editing) 'discountType': widget.percent ? 'PERCENT' : 'FIXED_KZT',
        if (!editing) 'discountValue': int.parse(value('discountValue')),
        if (editing || start != null)
          'startsAt': start?.toUtc().toIso8601String(),
        if (editing || end != null) 'endsAt': end?.toUtc().toIso8601String(),
        if (editing || value('maxRedemptions').isNotEmpty)
          'maxRedemptions': int.tryParse(value('maxRedemptions')),
      };
      if (editing) {
        await widget.api.put(
          '/api/organizer/campaigns/${Uri.encodeComponent(widget.campaign!['id'] as String)}',
          body,
        );
      } else {
        await widget.api.post(
          '/api/organizer/events/${widget.eventId}/campaigns',
          body,
        );
      }
      if (mounted) Navigator.pop(context, true);
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

  Widget input(
    String key,
    String label, {
    bool number = false,
    bool optional = false,
    int max = 1000000,
  }) => TextFormField(
    controller: fields[key],
    enabled: !busy && !(editing && key == 'discountValue'),
    decoration: InputDecoration(labelText: label),
    keyboardType: number ? TextInputType.number : null,
    validator: (raw) {
      final v = raw?.trim() ?? '';
      final invalid = tr(
        'Invalid value',
        'Недопустимое значение',
        'Жарамсыз мән',
      );
      if (v.isEmpty) return optional ? null : invalid;
      if (number) {
        final n = int.tryParse(v);
        return n == null || n < 1 || n > max ? invalid : null;
      }
      if (key == 'name') return v.length < 2 || v.length > 120 ? invalid : null;
      return DateTime.tryParse(v) == null ? invalid : null;
    },
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        editing
            ? tr('Edit campaign', 'Редактировать кампанию', 'Науқанды өңдеу')
            : tr('New campaign', 'Новая кампания', 'Жаңа науқан'),
      ),
    ),
    body: Form(
      key: form,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          input(
            'name',
            tr('Campaign name', 'Название кампании', 'Науқан атауы'),
          ),
          input(
            'discountValue',
            widget.percent
                ? tr('Discount (%)', 'Скидка (%)', 'Жеңілдік (%)')
                : tr('Discount (KZT)', 'Скидка (KZT)', 'Жеңілдік (KZT)'),
            number: true,
            max: widget.percent ? 100 : 1000000000,
          ),
          input(
            'maxRedemptions',
            tr(
              'Maximum redemptions (optional)',
              'Лимит активаций (необязательно)',
              'Қолдану шегі (міндетті емес)',
            ),
            number: true,
            optional: true,
          ),
          input(
            'perUserLimit',
            tr(
              'Per-user limit',
              'Лимит на пользователя',
              'Пайдаланушыға шектеу',
            ),
            number: true,
            max: 100,
          ),
          input(
            'startsAt',
            tr(
              'Starts at (ISO, optional)',
              'Начало (ISO, необязательно)',
              'Басталуы (ISO, міндетті емес)',
            ),
            optional: true,
          ),
          input(
            'endsAt',
            tr(
              'Ends at (ISO, optional)',
              'Окончание (ISO, необязательно)',
              'Аяқталуы (ISO, міндетті емес)',
            ),
            optional: true,
          ),
          if (editing)
            SwitchListTile(
              title: Text(tr('Active', 'Активна', 'Белсенді')),
              value: active,
              onChanged: busy ? null : (v) => setState(() => active = v),
            ),
          Text(
            tr(
              'Ticket types (none selected means all)',
              'Типы билетов (без выбора доступны все)',
              'Билет түрлері (таңдалмаса, барлығы)',
            ),
          ),
          for (final row in widget.types)
            if (row['id'] is String)
              CheckboxListTile(
                title: Text('${row['name']}'),
                value: selected.contains(row['id']),
                onChanged: busy
                    ? null
                    : (v) => setState(() {
                        if (v == true) {
                          selected.add(row['id'] as String);
                        } else {
                          selected.remove(row['id']);
                        }
                      }),
              ),
          if (error != null) Text(error!),
          FilledButton(
            onPressed: busy ? null : submit,
            child: Text(tr('Save', 'Сохранить', 'Сақтау')),
          ),
        ],
      ),
    ),
  );
}

class _ReportResult extends StatelessWidget {
  const _ReportResult({
    required this.data,
    required this.retry,
    required this.content,
  });
  final Future<Map<String, dynamic>> data;
  final VoidCallback retry;
  final Widget Function(Map<String, dynamic>) content;

  @override
  Widget build(BuildContext context) => FutureBuilder(
    future: data,
    builder: (context, snapshot) {
      if (snapshot.connectionState == ConnectionState.waiting) {
        return const LoadingState();
      }
      if (snapshot.hasError || !snapshot.hasData) {
        return _reportError(context, snapshot.error, retry);
      }
      return content(snapshot.data!);
    },
  );
}

Widget _reportError(BuildContext context, Object? error, VoidCallback retry) =>
    ErrorState(
      message: AppLocalizations.of(context)
          .apiError(error is ApiException ? error.code : ''),
      onRetry: retry,
    );
