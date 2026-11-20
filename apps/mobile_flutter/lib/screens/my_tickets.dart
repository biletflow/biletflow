import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import 'ticket_detail.dart';

class MyTicketsScreen extends StatefulWidget {
  final ApiClient api;
  const MyTicketsScreen({super.key, required this.api});

  @override
  State<MyTicketsScreen> createState() => _MyTicketsScreenState();
}

class _MyTicketsScreenState extends State<MyTicketsScreen> {
  List<dynamic> _tickets = const [];
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.api.get('/api/tickets');
      final tickets = data['tickets'];
      setState(() => _tickets = tickets is List ? tickets : const []);
    } on ApiException catch (error) {
      setState(() => _error = error.code);
    } catch (_) {
      setState(() => _error = 'REQUEST_FAILED');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.myTickets),
        actions: [
          IconButton(
            tooltip: l10n.refresh,
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(l10n.apiError(_error!)))
              : _tickets.isEmpty
                  ? Center(child: Text(l10n.noTickets))
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _tickets.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final raw = _tickets[index];
                        if (raw is! Map) return const SizedBox.shrink();
                        final ticket = Map<String, dynamic>.from(raw);
                        final event = ticket['event'];
                        final title = event is Map
                            ? '${event['title'] ?? 'Event'}'
                            : 'Event';
                        final when = event is Map ? '${event['startsAt'] ?? ''}' : '';
                        final id = '${ticket['id'] ?? ''}';
                        final ticketStatus = '${ticket['status'] ?? ''}';
                        return Card(
                          child: ListTile(
                            title: Text(title),
                            subtitle: Text(
                              [
                                '${ticket['ticketTypeName'] ?? ''}',
                                '${ticket['attendeeName'] ?? ''}',
                                l10n.ticketStatus(ticketStatus),
                                if (when.isNotEmpty) when,
                              ].where((part) => part.isNotEmpty).join(' · '),
                            ),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: id.isEmpty
                                ? null
                                : () => Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => TicketDetailScreen(
                                          api: widget.api,
                                          ticketId: id,
                                          summary: ticket,
                                        ),
                                      ),
                                    ),
                          ),
                        );
                      },
                    ),
    );
  }
}
