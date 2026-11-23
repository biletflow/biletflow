import 'package:material_ui/material_ui.dart';
import '../core/api.dart';
import 'organizer_reports.dart';

class OrganizerScreen extends StatefulWidget {
  final ApiClient api;
  const OrganizerScreen({super.key, required this.api});
  @override
  State<OrganizerScreen> createState() => _OrganizerScreenState();
}

class _OrganizerScreenState extends State<OrganizerScreen> {
  late Future<Map<String, dynamic>> events;
  @override
  void initState() { super.initState(); events = widget.api.get('/api/organizer/events'); }
  void refresh() {
    setState(() {
      events = widget.api.get('/api/organizer/events');
    });
  }
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('My events'), actions: [IconButton(onPressed: refresh, icon: const Icon(Icons.refresh))]), body: FutureBuilder(future: events, builder: (context, snapshot) {
    if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError) return Center(child: Text('${snapshot.error}'));
    final rows = snapshot.data?['events'];
    if (rows is! List) return const Center(child: Text('Unexpected event response'));
    if (rows.isEmpty) return const Center(child: Text('No events yet'));
    return ListView.builder(padding: const EdgeInsets.all(12), itemCount: rows.length, itemBuilder: (context, index) {
      final row = rows[index];
      if (row is! Map) return const SizedBox.shrink();
      return Card(child: ListTile(title: Text('${row['title'] ?? ''}'), subtitle: Text('${row['status'] ?? ''} · ${row['startsAt'] ?? ''}'), trailing: const Icon(Icons.chevron_right), onTap: row['id'] is String ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => EventScreen(api: widget.api, id: row['id'] as String))) : null));
    });
  }));
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
  @override
  void initState() {
    super.initState();
    eventFuture = widget.api.get('/api/organizer/events/${Uri.encodeComponent(widget.id)}');
  }
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Event details')), body: FutureBuilder(future: eventFuture, builder: (context, snapshot) {
    if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError) return Center(child: Text('${snapshot.error}'));
    final event = snapshot.data?['event'];
    if (event is! Map) return const Center(child: Text('Unexpected event response'));
    final types = event['ticketTypes'];
    return ListView(padding: const EdgeInsets.all(16), children: [
      Text('${event['title'] ?? ''}', style: Theme.of(context).textTheme.headlineSmall),
      Text('${event['status'] ?? ''}'), const SizedBox(height: 12), Text('${event['description'] ?? ''}'),
      OutlinedButton(
        onPressed: () => Navigator.push(context, MaterialPageRoute(
          builder: (_) => OrganizerReports(api: widget.api, eventId: widget.id),
        )),
        child: const Text('Attendance and campaigns'),
      ),
      const SizedBox(height: 20), const Text('Ticket types'),
      if (types is List) for (final type in types) if (type is Map) Card(child: ListTile(title: Text('${type['name']}'), subtitle: Text('${type['sold']} sold · ${type['available']} available'), trailing: Text('${type['priceKzt']} KZT'))),
    ]);
  }));
}
