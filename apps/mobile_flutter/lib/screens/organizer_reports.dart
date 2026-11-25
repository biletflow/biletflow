import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';
import 'organizer_editor.dart';
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
    final saved = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => OrganizerEditor(
      title: percent ? 'Percentage discount campaign' : 'Fixed KZT discount campaign',
      fields: const [
        (key: 'name', label: 'Campaign name', required: true, number: false),
        (key: 'discountValue', label: 'Discount value', required: true, number: true),
        (key: 'maxRedemptions', label: 'Maximum redemptions', required: false, number: true),
        (key: 'perUserLimit', label: 'Per-user limit', required: true, number: true),
      ],
      initial: {'discountType': percent ? 'PERCENT' : 'FIXED_KZT', 'perUserLimit': 1},
      save: (body) => widget.api.post('/api/organizer/events/$id/campaigns', body),
    )));
    if (mounted && saved == true) {
      setState(() {
        campaigns = widget.api.get('/api/organizer/events/$id/campaigns');
      });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Event reports')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Attendance', style: Theme.of(context).textTheme.titleLarge),
        _ReportResult(
          data: attendance,
          retry: () => setState(() {
            attendance = widget.api.get('/api/mobile/events/$id/stats');
          }),
          content: (stats) => ListTile(
            title: Text(
              '${stats['checkedIn']} / ${stats['registered']} checked in',
            ),
          ),
        ),
        Text('Campaigns', style: Theme.of(context).textTheme.titleLarge),
        Wrap(spacing: 8, children: [
          OutlinedButton(onPressed: () => createCampaign(true), child: Text(adminLabel(context,'New % campaign','Новая кампания %','Жаңа % науқан'))),
          OutlinedButton(onPressed: () => createCampaign(false), child: Text(adminLabel(context,'New KZT campaign','Новая кампания KZT','Жаңа KZT науқан'))),
        ]),
        _ReportResult(
          data: campaigns,
          retry: () => setState(() {
            campaigns = widget.api.get('/api/organizer/events/$id/campaigns');
          }),
          content: (data) {
            final rows = data['campaigns'] as List? ?? const [];
            if (rows.isEmpty) return const EmptyState(title: 'No campaigns');
            return Column(
              children: [
                for (final row in rows.whereType<Map<String, dynamic>>())
                  ListTile(
                    title: Text('${row['name']}'),
                    subtitle: Text(
                      '${row['status']} · ${row['redeemed']} redemptions',
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
    final update = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _EditCampaign(campaign: campaign),
    );
    if (!mounted || update == null || saving) return;
    setState(() => saving = true);
    try {
      final result = await widget.api.put(path, update);
      if (!mounted) return;
      final updated = result['campaign'];
      if (updated is! Map<String, dynamic>) throw const FormatException();
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      final message = AppLocalizations.of(context)
          .apiError(error is ApiException ? error.code : '');
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
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
            tooltip: 'Edit campaign',
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
                    title: const Text('Paid orders'),
                    trailing: Text('${row['orders']}'),
                  ),
                  ListTile(
                    title: const Text('Tickets'),
                    trailing: Text('${row['tickets']}'),
                  ),
                  ListTile(
                    title: const Text('Redemptions'),
                    trailing: Text('${row['redemptions']}'),
                  ),
                  for (final (key, label) in [
                    ('grossKzt', 'Gross sales'),
                    ('discountKzt', 'Discounts'),
                    ('netKzt', 'Net sales'),
                  ])
                    ListTile(
                      title: Text(label),
                      trailing: Text(l10n.money(row[key] as int)),
                    ),
                ],
              );
            },
          ),
          const Text('Campaign QR'),
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

class _EditCampaign extends StatefulWidget {
  const _EditCampaign({required this.campaign});
  final Map<String, dynamic> campaign;

  @override
  State<_EditCampaign> createState() => _EditCampaignState();
}

class _EditCampaignState extends State<_EditCampaign> {
  final form = GlobalKey<FormState>();
  late final name = TextEditingController(
    text: widget.campaign['name'] as String,
  );
  late bool active = widget.campaign['status'] == 'ACTIVE';

  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Edit campaign'),
    content: Form(
      key: form,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextFormField(
            controller: name,
            decoration: const InputDecoration(labelText: 'Campaign name'),
            maxLength: 120,
            validator: (value) => (value?.trim().length ?? 0) < 2
                ? 'Enter at least 2 characters'
                : null,
          ),
          SwitchListTile(
            title: const Text('Active'),
            value: active,
            onChanged: (value) => setState(() => active = value),
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () {
          if (!form.currentState!.validate()) return;
          Navigator.pop(context, <String, dynamic>{
            'name': name.text.trim(),
            'status': active ? 'ACTIVE' : 'DISABLED',
          });
        },
        child: const Text('Save'),
      ),
    ],
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
