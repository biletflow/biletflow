import 'package:material_ui/material_ui.dart';

import '../core/api.dart';

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
      if (order is! Map) {
        throw const ApiException(500, 'INVALID_ORDER_RESPONSE');
      }
      setState(() => _order = Map<String, dynamic>.from(order));
    } on ApiException catch (error) {
      setState(() => _error = error.code);
    } catch (_) {
      setState(() => _error = 'REQUEST_FAILED');
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
      final data = await widget.api.post('/api/orders/${widget.orderId}/cancel', {});
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

  @override
  Widget build(BuildContext context) {
    final order = _order;
    final status = '${order?['status'] ?? ''}';
    final reference = '${order?['reference'] ?? ''}';
    final total = order?['totalKzt'];
    final tickets = order?['tickets'];
    final awaiting = status == 'AWAITING_PAYMENT' || status == 'PENDING';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Order'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _busy ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null && order == null
              ? Center(child: Text(_error!))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(
                      reference.isEmpty ? 'Order' : reference,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text('Status: $status'),
                    if (total is num)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(total == 0 ? 'Total: Free' : 'Total: ₸${total.round()}'),
                      ),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          _error!,
                          style: TextStyle(color: Theme.of(context).colorScheme.error),
                        ),
                      ),
                    if (awaiting) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Simulated payment — no real money moves.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: _busy ? null : () => _simulate('APPROVED'),
                        child: const Text('Approve payment'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: _busy ? null : () => _simulate('DECLINED'),
                        child: const Text('Decline'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: _busy ? null : () => _simulate('ABANDONED'),
                        child: const Text('Abandon'),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: _busy ? null : _cancel,
                        child: const Text('Cancel reservation'),
                      ),
                    ],
                    if (status == 'PAID') ...[
                      const SizedBox(height: 16),
                      Text('Payment succeeded. Tickets are ready.',
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 8),
                      if (tickets is List)
                        ...tickets.whereType<Map>().map((raw) {
                          final ticket = Map<String, dynamic>.from(raw);
                          return Card(
                            child: ListTile(
                              title: Text('${ticket['ticketTypeName'] ?? 'Ticket'}'),
                              subtitle: Text(
                                [
                                  '${ticket['attendeeName'] ?? ''}',
                                  '${ticket['code'] ?? ''}',
                                  '${ticket['status'] ?? ''}',
                                ].where((part) => part.isNotEmpty).join(' · '),
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
                        status == 'EXPIRED'
                            ? 'Checkout hold expired. No ticket was issued.'
                            : 'Order closed without tickets.',
                      ),
                    ],
                  ],
                ),
    );
  }
}
