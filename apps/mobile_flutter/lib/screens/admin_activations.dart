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
    final approve = decision == 'APPROVE';
    final action = approve ? 'Approve' : 'Reject';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('$action paid-sales review?'),
        content: Text(
          approve
              ? 'This records approval for the organizer’s identity review.'
              : 'This records rejection and disables paid sales for the event.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Back'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(action),
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
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Paid-sales reviews'),
      actions: [
        IconButton(
          onPressed: reviewing ? null : reload,
          icon: const Icon(Icons.refresh),
          tooltip: 'Refresh',
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
            message: AppLocalizations.of(context).apiError(''),
            onRetry: reload,
          );
        }
        if (rows.isEmpty) return const EmptyState(title: 'No pending reviews');
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
                      Text(row['feePaid'] == true ? 'Fee paid' : 'Fee pending'),
                      Text(
                        row['payoutAccountConnected'] == true
                            ? 'Payout account connected'
                            : 'Payout account pending',
                      ),
                      Wrap(
                        spacing: 8,
                        children: [
                          OutlinedButton(
                            onPressed: reviewing
                                ? null
                                : () => review(row['id'] as String, 'REJECT'),
                            child: const Text('Reject'),
                          ),
                          FilledButton(
                            onPressed: reviewing
                                ? null
                                : () => review(row['id'] as String, 'APPROVE'),
                            child: const Text('Approve'),
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
