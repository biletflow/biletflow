import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import 'organizer_editor.dart';

const eventFields = [
  (key: 'title', label: 'Event title', required: true, number: false),
  (key: 'description', label: 'Description', required: false, number: false),
  (
    key: 'startsAt',
    label: 'Starts at (ISO date and time)',
    required: true,
    number: false,
  ),
  (
    key: 'endsAt',
    label: 'Ends at (ISO date and time)',
    required: true,
    number: false,
  ),
  (key: 'capacity', label: 'Capacity', required: false, number: true),
];

const ticketFields = [
  (key: 'name', label: 'Ticket name', required: true, number: false),
  (key: 'description', label: 'Description', required: false, number: false),
  (key: 'priceKzt', label: 'Price in KZT', required: true, number: true),
  (key: 'quantity', label: 'Quantity', required: true, number: true),
  (
    key: 'maxPerOrder',
    label: 'Maximum per order',
    required: true,
    number: true,
  ),
];

Map<String, dynamic> _settings(Map row, List<String> keys) => {
  for (final key in keys)
    if (row[key] != null) key: row[key],
};

class OrganizerScreen extends StatefulWidget {
  final ApiClient api;
  const OrganizerScreen({super.key, required this.api});
  @override
  State<OrganizerScreen> createState() => _OrganizerScreenState();
}

class _OrganizerScreenState extends State<OrganizerScreen> {
  late Future<Map<String, dynamic>> events;
  @override
  void initState() {
    super.initState();
    events = widget.api.get('/api/organizer/events');
  }

  void refresh() =>
      setState(() => events = widget.api.get('/api/organizer/events'));
  Future<void> createEvent() async {
    final starts = DateTime.now().toUtc().add(const Duration(days: 1));
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => OrganizerEditor(
          title: 'Create event',
          fields: eventFields,
          initial: {
            'startsAt': starts.toIso8601String(),
            'endsAt': starts.add(const Duration(hours: 2)).toIso8601String(),
          },
          save: (body) => widget.api.post('/api/organizer/events', body),
        ),
      ),
    );
    if (mounted && saved == true) refresh();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    floatingActionButton: FloatingActionButton.extended(
      onPressed: createEvent,
      icon: const Icon(Icons.add),
      label: const Text('Create event'),
    ),
    appBar: AppBar(
      title: const Text('My events'),
      actions: [
        IconButton(onPressed: refresh, icon: const Icon(Icons.refresh)),
      ],
    ),
    body: FutureBuilder(
      future: events,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) return Center(child: Text('${snapshot.error}'));
        final rows = snapshot.data?['events'];
        if (rows is! List) {
          return const Center(child: Text('Unexpected event response'));
        }
        if (rows.isEmpty) return const Center(child: Text('No events yet'));
        return ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: rows.length,
          itemBuilder: (context, index) {
            final row = rows[index];
            if (row is! Map) return const SizedBox.shrink();
            return Card(
              child: ListTile(
                title: Text('${row['title'] ?? ''}'),
                subtitle: Text(
                  '${row['status'] ?? ''} · ${row['startsAt'] ?? ''}',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: row['id'] is String
                    ? () async {
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => EventScreen(
                              api: widget.api,
                              id: row['id'] as String,
                            ),
                          ),
                        );
                        if (mounted) refresh();
                      }
                    : null,
              ),
            );
          },
        );
      },
    ),
  );
}

class EventScreen extends StatefulWidget {
  final ApiClient api;
  final String id;
  const EventScreen({super.key, required this.api, required this.id});
  @override
  State<EventScreen> createState() => _EventScreenState();
}

class _EventScreenState extends State<EventScreen> {
  late Future<Map<String, dynamic>> eventFuture;
  bool changing = false;
  String get path => '/api/organizer/events/${Uri.encodeComponent(widget.id)}';

  void reload() => setState(() => eventFuture = widget.api.get(path));

  Future<void> editEvent(Map event) async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => OrganizerEditor(
          title: 'Edit event',
          fields: eventFields,
          initial: _settings(event, [
            'title',
            'description',
            'category',
            'coverImageUrl',
            'venueId',
            'visibility',
            'seatingMode',
            'startsAt',
            'endsAt',
            'timezone',
            'registrationOpensAt',
            'registrationClosesAt',
            'capacity',
            'refundPolicy',
          ]),
          save: (body) => widget.api.put(path, body),
        ),
      ),
    );
    if (mounted && saved == true) reload();
  }

  Future<void> editTicket([Map? ticket]) async {
    final id = ticket?['id'];
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => OrganizerEditor(
          title: ticket == null ? 'Add ticket type' : 'Edit ticket type',
          fields: ticketFields,
          initial: ticket == null
              ? {'priceKzt': 0, 'quantity': 10, 'maxPerOrder': 10}
              : _settings(ticket, [
                  'name',
                  'description',
                  'priceKzt',
                  'quantity',
                  'maxPerOrder',
                  'salesStartAt',
                  'salesEndAt',
                  'isHidden',
                ]),
          save: (body) => id is String
              ? widget.api.put(
                  '/api/organizer/ticket-types/${Uri.encodeComponent(id)}',
                  body,
                )
              : widget.api.post('$path/ticket-types', body),
        ),
      ),
    );
    if (mounted && saved == true) reload();
  }

  Future<void> eventAction(String action) async {
    if (changing) return;
    if (action == 'cancel') {
      final saved = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => OrganizerEditor(
            title: 'Cancel event',
            fields: const [
              (
                key: 'reason',
                label: 'Reason for cancellation',
                required: true,
                number: false,
              ),
            ],
            initial: const {},
            save: (body) => widget.api.post('$path/cancel', body),
          ),
        ),
      );
      if (mounted && saved == true) reload();
      return;
    }
    setState(() => changing = true);
    try {
      await widget.api.post('$path/$action', {});
      if (!mounted) return;
      if (action == 'duplicate') {
        Navigator.pop(context);
      } else {
        reload();
      }
    } catch (failure) {
      if (!mounted) return;
      final message = AppLocalizations.of(context)
          .apiError(failure is ApiException ? failure.code : '');
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => changing = false);
    }
  }

  @override
  void initState() {
    super.initState();
    eventFuture = widget.api.get(
      '/api/organizer/events/${Uri.encodeComponent(widget.id)}',
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Event details')),
    body: FutureBuilder(
      future: eventFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) return Center(child: Text('${snapshot.error}'));
        final event = snapshot.data?['event'];
        if (event is! Map) {
          return const Center(child: Text('Unexpected event response'));
        }
        final types = event['ticketTypes'];
        final status = event['status'];
        final editable = status == 'DRAFT' || status == 'PUBLISHED';
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              '${event['title'] ?? ''}',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            Text('${event['status'] ?? ''}'),
            const SizedBox(height: 12),
            Text('${event['description'] ?? ''}'),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: [
                if (editable)
                  OutlinedButton(
                    onPressed: changing ? null : () => editEvent(event),
                    child: const Text('Edit event'),
                  ),
                if (status == 'DRAFT')
                  OutlinedButton(
                    onPressed: changing ? null : () => eventAction('publish'),
                    child: const Text('Publish'),
                  ),
                if (status == 'PUBLISHED')
                  OutlinedButton(
                    onPressed: changing ? null : () => eventAction('unpublish'),
                    child: const Text('Unpublish'),
                  ),
                if (editable)
                  OutlinedButton(
                    onPressed: changing ? null : () => eventAction('cancel'),
                    child: const Text('Cancel event'),
                  ),
                OutlinedButton(
                  onPressed: changing ? null : () => eventAction('duplicate'),
                  child: const Text('Duplicate'),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Text('Ticket types'),
            if (editable)
              TextButton(
                onPressed: changing ? null : () => editTicket(),
                child: const Text('Add ticket type'),
              ),
            if (types is List)
              for (final type in types)
                if (type is Map)
                  Card(
                    child: ListTile(
                      title: Text('${type['name']}'),
                      onTap: editable && !changing
                          ? () => editTicket(type)
                          : null,
                      subtitle: Text(
                        '${type['sold']} sold · ${type['available']} available',
                      ),
                      trailing: Text('${type['priceKzt']} KZT'),
                    ),
                  ),
          ],
        );
      },
    ),
  );
}
