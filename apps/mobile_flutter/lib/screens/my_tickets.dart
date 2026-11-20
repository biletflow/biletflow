import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('My tickets'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _tickets.isEmpty
                  ? const Center(child: Text('No tickets yet'))
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
                        return Card(
                          child: ListTile(
                            title: Text(title),
                            subtitle: Text(
                              [
                                '${ticket['ticketTypeName'] ?? ''}',
                                '${ticket['attendeeName'] ?? ''}',
                                '${ticket['status'] ?? ''}',
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
