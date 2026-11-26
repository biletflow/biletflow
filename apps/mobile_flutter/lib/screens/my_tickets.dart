import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';
import '../widgets/status_badge.dart';
import 'order_history.dart';
import 'order_status.dart';
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
      if (!mounted) return;
      final tickets = data['tickets'];
      setState(() => _tickets = tickets is List ? tickets : const []);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.code);
    } catch (_) {
      if (mounted) setState(() => _error = 'REQUEST_FAILED');
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
            tooltip: l10n.orderHistory,
            icon: const Icon(Icons.receipt_long_outlined),
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => OrderHistoryScreen(api: widget.api),
                ),
              );
              if (mounted) _load();
            },
          ),
          IconButton(
            tooltip: l10n.refresh,
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const LoadingState()
          : _error != null
          ? ErrorState(
              message: l10n.apiError(_error!),
              onRetry: _load,
              retryLabel: l10n.refresh,
            )
          : _tickets.isEmpty
          ? EmptyState(
              icon: Icons.confirmation_number_outlined,
              title: l10n.noTickets,
            )
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
                    ? '${event['title'] ?? l10n.eventDetails}'
                    : l10n.eventDetails;
                final when = event is Map
                    ? formatEventWhen(event['startsAt'], context: context)
                    : '';
                final id = '${ticket['id'] ?? ''}';
                final orderId = ticket['orderId'];
                final ticketStatus = '${ticket['status'] ?? ''}';
                return Card(
                  child: ListTile(
                    title: Text(title),
                    subtitle: Text(
                      [
                        '${ticket['ticketTypeName'] ?? ''}',
                        '${ticket['attendeeName'] ?? ''}',
                        if (when.isNotEmpty) when,
                      ].where((part) => part.isNotEmpty).join(' · '),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        StatusBadge.ticket(
                          ticketStatus,
                          l10n.ticketStatus(ticketStatus),
                        ),
                        if (orderId is String && orderId.isNotEmpty)
                          IconButton(
                            tooltip: l10n.order,
                            icon: const Icon(Icons.receipt_long_outlined),
                            onPressed: () async {
                              await Navigator.push<void>(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => OrderStatusScreen(
                                    api: widget.api,
                                    orderId: orderId,
                                  ),
                                ),
                              );
                              if (mounted) await _load();
                            },
                          )
                        else
                          const Icon(Icons.chevron_right),
                      ],
                    ),
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
