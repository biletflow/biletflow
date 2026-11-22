import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';
import '../widgets/status_badge.dart';

class OrganizerScreen extends StatefulWidget {
  final ApiClient api;
  const OrganizerScreen({super.key, required this.api});

  @override
  State<OrganizerScreen> createState() => _OrganizerScreenState();
}

class _OrganizerScreenState extends State<OrganizerScreen> {
  late Future<Map<String, dynamic>> events;
  String? statusFilter;

  @override
  void initState() {
    super.initState();
    events = widget.api.get('/api/organizer/events');
  }

  void refresh() {
    setState(() => events = widget.api.get('/api/organizer/events'));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.myEvents),
        actions: [
          IconButton(
            tooltip: l10n.refresh,
            onPressed: refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: FutureBuilder(
        future: events,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingState();
          }
          final rows = snapshot.data?['events'];
          if (snapshot.hasError || rows is! List) {
            return _organizerError(l10n, snapshot.error, refresh);
          }
          final ownedEvents = rows.whereType<Map<String, dynamic>>().toList();
          if (ownedEvents.isEmpty) return EmptyState(title: l10n.noEvents);
          final statuses = ownedEvents
              .map((event) => event['status'])
              .whereType<String>()
              .toSet();
          final selected = statuses.contains(statusFilter)
              ? statusFilter
              : null;
          final visible = ownedEvents.where(
            (event) => selected == null || event['status'] == selected,
          );

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Wrap(
                spacing: 8,
                children: [
                  for (final status in [null, ...statuses])
                    ChoiceChip(
                      label: Text(
                        status == null
                            ? l10n.allEventStatuses
                            : l10n.eventStatus(status),
                      ),
                      selected: selected == status,
                      onSelected: (_) => setState(() => statusFilter = status),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              for (final event in visible)
                Card(
                  child: ListTile(
                    title: Text('${event['title'] ?? ''}'),
                    subtitle: Text(_eventDate(context, event['startsAt'])),
                    trailing: _eventStatus(l10n, event['status']),
                    onTap: event['id'] is String
                        ? () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => EventScreen(
                                api: widget.api,
                                id: event['id'] as String,
                              ),
                            ),
                          )
                        : null,
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
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
  Future<Map<String, dynamic>> loadEvent() =>
      widget.api.get('/api/organizer/events/${Uri.encodeComponent(widget.id)}');

  @override
  void initState() {
    super.initState();
    eventFuture = loadEvent();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.eventDetails)),
      body: FutureBuilder(
        future: eventFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingState();
          }
          final event = snapshot.data?['event'];
          if (snapshot.hasError || event is! Map<String, dynamic>) {
            return _organizerError(l10n, snapshot.error, () {
              setState(() => eventFuture = loadEvent());
            });
          }
          final types = event['ticketTypes'];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                '${event['title'] ?? ''}',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: _eventStatus(l10n, event['status']),
              ),
              Text(_eventDate(context, event['startsAt'])),
              const SizedBox(height: 12),
              Text('${event['description'] ?? ''}'),
              if (types is List && types.isNotEmpty) ...[
                const SizedBox(height: 20),
                Text(
                  l10n.ticketTypes,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                for (final type in types.whereType<Map<String, dynamic>>())
                  Card(
                    child: ListTile(
                      title: Text('${type['name'] ?? ''}'),
                      subtitle: type['sold'] is int && type['available'] is int
                          ? Text(
                              l10n.ticketInventory(
                                type['sold'] as int,
                                type['available'] as int,
                              ),
                            )
                          : null,
                      trailing: type['priceKzt'] is int
                          ? Text(l10n.money(type['priceKzt'] as int))
                          : null,
                    ),
                  ),
              ],
            ],
          );
        },
      ),
    );
  }
}

Widget _organizerError(
  AppLocalizations l10n,
  Object? error,
  VoidCallback retry,
) {
  final code = switch (error) {
    ApiException(status: 401) => 'UNAUTHENTICATED',
    ApiException(status: 404) => 'NOT_FOUND',
    _ => '',
  };
  return ErrorState(
    message: l10n.apiError(code),
    onRetry: retry,
    retryLabel: l10n.refresh,
  );
}

String _eventDate(BuildContext context, Object? value) {
  final date = value is String ? DateTime.tryParse(value)?.toLocal() : null;
  if (date == null) return '';
  final formats = MaterialLocalizations.of(context);
  return '${formats.formatMediumDate(date)} · ${formats.formatTimeOfDay(TimeOfDay.fromDateTime(date))}';
}

Widget _eventStatus(AppLocalizations l10n, Object? value) {
  if (value is! String || value.isEmpty) return const SizedBox.shrink();
  return StatusBadge(
    label: l10n.eventStatus(value),
    tone: switch (value) {
      'PUBLISHED' => StatusTone.success,
      'CANCELLED' => StatusTone.danger,
      'COMPLETED' => StatusTone.info,
      _ => StatusTone.neutral,
    },
  );
}
