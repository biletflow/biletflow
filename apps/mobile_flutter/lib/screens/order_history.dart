import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';
import '../widgets/status_badge.dart';
import 'order_status.dart';

class OrderHistoryScreen extends StatefulWidget {
  const OrderHistoryScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<OrderHistoryScreen> createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends State<OrderHistoryScreen> {
  late Future<Map<String, dynamic>> _orders = widget.api.get('/api/orders');

  void _refresh() => setState(() => _orders = widget.api.get('/api/orders'));

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.orderHistory),
        actions: [
          IconButton(
            tooltip: l10n.refresh,
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: FutureBuilder(
        future: _orders,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingState();
          }
          if (snapshot.hasError) {
            final error = snapshot.error;
            return ErrorState(
              message: l10n.apiError(error is ApiException ? error.code : ''),
              onRetry: _refresh,
              retryLabel: l10n.refresh,
            );
          }
          final raw = snapshot.data?['orders'];
          final orders = raw is List ? raw.whereType<Map>().toList() : <Map>[];
          if (orders.isEmpty) {
            return EmptyState(
              icon: Icons.receipt_long_outlined,
              title: l10n.noOrders,
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: orders.length,
            itemBuilder: (context, index) {
              final order = orders[index];
              final id = order['id'] as String;
              final status = order['status'] as String;
              final total = (order['totalKzt'] as num).round();
              return Card(
                child: ListTile(
                  title: Text('${order['reference']}'),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        total > 0
                            ? '${l10n.money(total)} · ${l10n.testTransaction}'
                            : l10n.free,
                      ),
                      StatusBadge.order(status, l10n.orderStatus(status)),
                    ],
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) =>
                            OrderStatusScreen(api: widget.api, orderId: id),
                      ),
                    );
                    if (mounted) _refresh();
                  },
                ),
              );
            },
          );
        },
      ),
    );
  }
}
