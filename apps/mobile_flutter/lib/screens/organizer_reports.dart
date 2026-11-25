import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';

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

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.eventReports)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(l10n.attendance, style: Theme.of(context).textTheme.titleLarge),
          _ReportResult(
            data: attendance,
            retry: () => setState(() {
              attendance = widget.api.get('/api/mobile/events/$id/stats');
            }),
            content: (stats) => ListTile(
              title: Text(
                l10n.checkedInCount(stats['checkedIn'], stats['registered']),
              ),
            ),
          ),
          Text(l10n.campaigns, style: Theme.of(context).textTheme.titleLarge),
          _ReportResult(
            data: campaigns,
            retry: () => setState(() {
              campaigns = widget.api.get('/api/organizer/events/$id/campaigns');
            }),
            content: (data) {
              final rows = data['campaigns'] as List? ?? const [];
              if (rows.isEmpty) return EmptyState(title: l10n.noCampaigns);
              return Column(
                children: [
                  for (final row in rows.whereType<Map<String, dynamic>>())
                    ListTile(
                      title: Text('${row['name']}'),
                      subtitle: Text(
                        l10n.campaignSubtitle(row['status'], row['redeemed']),
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
                      trailing: Text(l10n.money(row[key] as int)),
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
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(l10n.editCampaign),
      content: Form(
        key: form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: name,
              decoration: InputDecoration(labelText: l10n.campaignName),
              maxLength: 120,
              validator: (value) =>
                  (value?.trim().length ?? 0) < 2 ? l10n.nameRequired : null,
            ),
            SwitchListTile(
              title: Text(l10n.active),
              value: active,
              onChanged: (value) => setState(() => active = value),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(l10n.cancel),
        ),
        FilledButton(
          onPressed: () {
            if (!form.currentState!.validate()) return;
            Navigator.pop(context, <String, dynamic>{
              'name': name.text.trim(),
              'status': active ? 'ACTIVE' : 'DISABLED',
            });
          },
          child: Text(l10n.save),
        ),
      ],
    );
  }
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
