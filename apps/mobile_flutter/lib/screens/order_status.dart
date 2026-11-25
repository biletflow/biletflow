import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';
import '../widgets/status_badge.dart';
import 'support.dart';
import 'ticket_detail.dart';

class OrderStatusScreen extends StatefulWidget {
  final ApiClient api;
  final String orderId;

  const OrderStatusScreen({
    super.key,
    required this.api,
    required this.orderId,
  });

  @override
  State<OrderStatusScreen> createState() => _OrderStatusScreenState();
}

class _OrderStatusScreenState extends State<OrderStatusScreen> {
  Map<String, dynamic>? _order;
  String? _error;
  bool _loading = true;
  bool _busy = false;

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
      final data = await widget.api.get('/api/orders/${widget.orderId}');
      final order = data['order'];
      if (!mounted) return;
      if (order is! Map) {
        throw const ApiException(500, 'INVALID_ORDER_RESPONSE');
      }
      setState(() => _order = Map<String, dynamic>.from(order));
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.code);
    } catch (_) {
      if (mounted) setState(() => _error = 'REQUEST_FAILED');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _simulate(String outcome) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await widget.api.post(
        '/api/orders/${widget.orderId}/pay/simulate',
        {'outcome': outcome},
      );
      final order = data['order'];
      if (order is Map) {
        setState(() => _order = Map<String, dynamic>.from(order));
      } else {
        await _load();
      }
    } on ApiException catch (error) {
      setState(() => _error = error.code);
      await _load();
    } catch (_) {
      setState(() => _error = 'REQUEST_FAILED');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await widget.api.post(
        '/api/orders/${widget.orderId}/cancel',
        {},
      );
      final order = data['order'];
      if (order is Map) {
        setState(() => _order = Map<String, dynamic>.from(order));
      } else {
        await _load();
      }
    } on ApiException catch (error) {
      setState(() => _error = error.code);
    } catch (_) {
      setState(() => _error = 'REQUEST_FAILED');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refund() async {
    if (_busy || _order?['status'] != 'PAID') return;
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.refundOrder),
        content: Text(l10n.refundConfirmation),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(MaterialLocalizations.of(context).cancelButtonLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(l10n.refundOrder),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true || _busy || _order?['status'] != 'PAID') {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.post(
        '/api/orders/${Uri.encodeComponent(widget.orderId)}/refund',
        {},
      );
      if (mounted) await _load();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.code);
    } catch (_) {
      if (mounted) setState(() => _error = 'REQUEST_FAILED');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final order = _order;
    final status = '${order?['status'] ?? ''}';
    final reference = '${order?['reference'] ?? ''}';
    final total = order?['totalKzt'];
    final tickets = order?['tickets'];
    final awaiting = status == 'AWAITING_PAYMENT' || status == 'PENDING';

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.order),
        actions: [
          IconButton(
            tooltip: l10n.refresh,
            onPressed: _busy ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const LoadingState()
          : _error != null && order == null
          ? ErrorState(
              message: l10n.apiError(_error!),
              onRetry: _load,
              retryLabel: l10n.refresh,
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  reference.isEmpty ? l10n.order : reference,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: StatusBadge.order(
                    status,
                    status == 'REFUNDED' ? l10n.ticketStatus(status) : status,
                  ),
                ),
                if (total is num)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      l10n.totalLabel(formatKzt(total, freeLabel: l10n.free)),
                    ),
                  ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      l10n.apiError(_error!),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                if (awaiting) ...[
                  const SizedBox(height: 16),
                  Text(
                    l10n.simulatedPayment,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: _busy ? null : () => _simulate('APPROVED'),
                    child: Text(l10n.approvePayment),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: _busy ? null : () => _simulate('DECLINED'),
                    child: Text(l10n.decline),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: _busy ? null : () => _simulate('ABANDONED'),
                    child: Text(l10n.abandon),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _busy ? null : _cancel,
                    child: Text(l10n.cancelReservation),
                  ),
                ],
                if (status == 'PAID') ...[
                  if (tickets is List &&
                      tickets.isNotEmpty &&
                      !tickets.whereType<Map>().any(
                        (ticket) => ticket['status'] == 'CHECKED_IN',
                      ))
                    OutlinedButton(
                      onPressed: _busy ? null : _refund,
                      child: Text(l10n.refundOrder),
                    ),
                  OutlinedButton(
                    onPressed: _busy
                        ? null
                        : () async {
                            final id = await Navigator.push<String>(
                              context,
                              MaterialPageRoute(
                                builder: (_) => SupportComposer(
                                  api: widget.api,
                                  orderId: widget.orderId,
                                ),
                              ),
                            );
                            if (!context.mounted || id == null) return;
                            await Navigator.push<void>(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    SupportThread(api: widget.api, id: id),
                              ),
                            );
                          },
                    child: Text(l10n.askRefund),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    l10n.paymentSucceeded,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  if (tickets is List)
                    ...tickets.whereType<Map>().map((raw) {
                      final ticket = Map<String, dynamic>.from(raw);
                      final id = '${ticket['id'] ?? ''}';
                      final ticketStatus = '${ticket['status'] ?? ''}';
                      return Card(
                        child: ListTile(
                          title: Text(
                            '${ticket['ticketTypeName'] ?? 'Ticket'}',
                          ),
                          subtitle: Text(
                            [
                              '${ticket['attendeeName'] ?? ''}',
                              l10n.ticketStatus(ticketStatus),
                            ].where((part) => part.isNotEmpty).join(' · '),
                          ),
                          trailing: id.isEmpty
                              ? null
                              : const Icon(Icons.chevron_right),
                          onTap: id.isEmpty
                              ? null
                              : () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => TicketDetailScreen(
                                      api: widget.api,
                                      ticketId: id,
                                      summary: {
                                        ...ticket,
                                        'ticketTypeName':
                                            ticket['ticketTypeName'],
                                        'attendeeName': ticket['attendeeName'],
                                        'status': ticket['status'],
                                        'event': {
                                          'title':
                                              '${l10n.order} ${order?['reference'] ?? ''}',
                                        },
                                      },
                                    ),
                                  ),
                                ),
                        ),
                      );
                    }),
                ],
                if (status == 'CANCELLED' ||
                    status == 'EXPIRED' ||
                    status == 'FAILED') ...[
                  const SizedBox(height: 16),
                  Text(
                    status == 'EXPIRED' ? l10n.holdExpired : l10n.orderClosed,
                  ),
                ],
              ],
            ),
    );
  }
}
