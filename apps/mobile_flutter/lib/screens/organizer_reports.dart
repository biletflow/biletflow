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
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) =>
                            _CampaignReport(api: widget.api, campaign: row),
                      ),
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

  Future<Uint8List> loadQr() async => Uint8List.fromList(
    await widget.api.getBytes('$path/qr.png', accept: 'image/png'),
  );

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('${widget.campaign['name']}')),
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
