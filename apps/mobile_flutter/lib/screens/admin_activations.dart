import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';

class AdminActivations extends StatefulWidget {
  const AdminActivations({super.key, required this.api});
  final ApiClient api;

  @override
  State<AdminActivations> createState() => _AdminActivationsState();
}

class _AdminActivationsState extends State<AdminActivations> {
  static const path = '/api/admin/activations';
  late var queue = widget.api.get(path);
  bool reviewing = false;

  void reload() => setState(() {
    queue = widget.api.get(path);
  });

  Future<void> review(String id, String decision) async {
    if (reviewing) return;
    final l10n = AppLocalizations.of(context);
    final approve = decision == 'APPROVE';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(approve ? l10n.approveReviewTitle : l10n.rejectReviewTitle),
        content: Text(approve ? l10n.approveReviewBody : l10n.rejectReviewBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l10n.back),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(approve ? l10n.approve : l10n.reject),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true || reviewing) return;
    setState(() => reviewing = true);
    try {
      await widget.api.post('$path/${Uri.encodeComponent(id)}/review', {
        'decision': decision,
      });
      if (mounted) reload();
    } catch (error) {
      if (!mounted) return;
      final message = AppLocalizations.of(context)
          .apiError(error is ApiException ? error.code : '');
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => reviewing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.paidSalesReviews),
        actions: [
          IconButton(
            onPressed: reviewing ? null : reload,
            icon: const Icon(Icons.refresh),
            tooltip: l10n.refresh,
          ),
        ],
      ),
      body: FutureBuilder(
        future: queue,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingState();
          }
          final rows = snapshot.data?['activations'];
          if (snapshot.hasError || rows is! List) {
            return ErrorState(
              message: l10n.apiError(''),
              onRetry: reload,
              retryLabel: l10n.retry,
            );
          }
          if (rows.isEmpty) return EmptyState(title: l10n.noPendingReviews);
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              for (final row in rows.whereType<Map<String, dynamic>>())
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${(row['event'] as Map)['title']}',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text('${(row['organizer'] as Map)['name']}'),
                        Text(
                          row['feePaid'] == true
                              ? l10n.feePaid
                              : l10n.feePending,
                        ),
                        Text(
                          row['payoutAccountConnected'] == true
                              ? l10n.payoutConnected
                              : l10n.payoutPending,
                        ),
                        Wrap(
                          spacing: 8,
                          children: [
                            OutlinedButton(
                              onPressed: reviewing
                                  ? null
                                  : () => review(row['id'] as String, 'REJECT'),
                              child: Text(l10n.reject),
                            ),
                            FilledButton(
                              onPressed: reviewing
                                  ? null
                                  : () =>
                                        review(row['id'] as String, 'APPROVE'),
                              child: Text(l10n.approve),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
