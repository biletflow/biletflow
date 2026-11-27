import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';
import '../widgets/status_badge.dart';
import 'organizer_editor.dart';
import 'organizer_reports.dart';
import 'organizer_seats.dart';

List<EditorField> _eventFields(AppLocalizations l10n) => [
  (key: 'title', label: l10n.eventTitle, required: true, number: false),
  (key: 'description', label: l10n.description, required: false, number: false),
  (key: 'startsAt', label: l10n.startsAt, required: true, number: false),
  (key: 'endsAt', label: l10n.endsAt, required: true, number: false),
  (key: 'capacity', label: l10n.capacity, required: false, number: true),
];

List<EditorField> _ticketFields(AppLocalizations l10n) => [
  (key: 'name', label: l10n.ticketName, required: true, number: false),
  (key: 'description', label: l10n.description, required: false, number: false),
  (key: 'priceKzt', label: l10n.priceKzt, required: true, number: true),
  (key: 'quantity', label: l10n.quantity, required: true, number: true),
  (key: 'maxPerOrder', label: l10n.maxPerOrder, required: true, number: true),
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
  String? statusFilter;

  @override
  void initState() {
    super.initState();
    events = widget.api.get('/api/organizer/events');
  }

  void refresh() => setState(() {
    events = widget.api.get('/api/organizer/events');
  });

  Future<void> createEvent() async {
    final l10n = AppLocalizations.of(context);
    final starts = DateTime.now().toUtc().add(const Duration(days: 1));
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => OrganizerEditor(
          title: l10n.createEvent,
          fields: _eventFields(l10n),
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
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: createEvent,
        icon: const Icon(Icons.add),
        label: Text(l10n.createEvent),
      ),
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
          if (ownedEvents.isEmpty) {
            return EmptyState(title: l10n.noEvents);
          }
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
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
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
                        ? () async {
                            await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => EventScreen(
                                  api: widget.api,
                                  id: event['id'] as String,
                                ),
                              ),
                            );
                            if (mounted) refresh();
                          }
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
  bool changing = false;
  String get path => '/api/organizer/events/${Uri.encodeComponent(widget.id)}';

  @override
  void initState() {
    super.initState();
    eventFuture = widget.api.get(path);
  }

  void reload() => setState(() {
    eventFuture = widget.api.get(path);
  });

  Future<void> editEvent(Map event) async {
    final l10n = AppLocalizations.of(context);
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => OrganizerEditor(
          title: l10n.editEvent,
          fields: _eventFields(l10n),
          initial: _settings(event, [
            'title',
            'description',
            'startsAt',
            'endsAt',
            'capacity',
          ]),
          save: (body) => widget.api.put(path, body),
        ),
      ),
    );
    if (mounted && saved == true) reload();
  }

  Future<void> editTicket([Map? ticket]) async {
    final l10n = AppLocalizations.of(context);
    final id = ticket?['id'];
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => OrganizerEditor(
          title: ticket == null ? l10n.addTicketType : l10n.editTicketType,
          fields: _ticketFields(l10n),
          initial: ticket == null
              ? {'priceKzt': 0, 'quantity': 10, 'maxPerOrder': 10}
              : _settings(ticket, [
                  'name',
                  'description',
                  'priceKzt',
                  'quantity',
                  'maxPerOrder',
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

  Future<void> deleteTicket(String id) async {
    if (changing) return;
    final l10n = AppLocalizations.of(context);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.deleteTicketTypeTitle),
        content: Text(l10n.deleteTicketTypeBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.back),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(l10n.delete),
          ),
        ],
      ),
    );
    if (!mounted || confirm != true || changing) return;
    setState(() => changing = true);
    try {
      await widget.api.request(
        'DELETE',
        '/api/organizer/ticket-types/${Uri.encodeComponent(id)}',
      );
      if (mounted) reload();
    } catch (error) {
      if (!mounted) return;
      final message = error is ApiException && error.status == 409
          ? l10n.hideTicketType
          : l10n.apiError(error is ApiException ? error.code : '');
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => changing = false);
    }
  }

  Future<void> eventAction(String action) async {
    if (changing) return;
    final l10n = AppLocalizations.of(context);
    if (action == 'cancel') {
      final saved = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => OrganizerEditor(
            title: l10n.cancelEvent,
            fields: [
              (
                key: 'reason',
                label: l10n.cancelReason,
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
      final message = l10n.apiError(
        failure is ApiException ? failure.code : '',
      );
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => changing = false);
    }
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
            return _organizerError(l10n, snapshot.error, reload);
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
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: _eventStatus(l10n, event['status']),
              ),
              Text(_eventDate(context, event['startsAt'])),
              const SizedBox(height: 12),
              Text('${event['description'] ?? ''}'),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton(
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => OrganizerReports(
                          api: widget.api,
                          eventId: widget.id,
                        ),
                      ),
                    ),
                    child: Text(l10n.attendanceAndCampaigns),
                  ),
                  if (editable)
                    OutlinedButton(
                      onPressed: changing ? null : () => editEvent(event),
                      child: Text(l10n.editEvent),
                    ),
                  if (status == 'DRAFT')
                    OutlinedButton(
                      onPressed: changing ? null : () => eventAction('publish'),
                      child: Text(l10n.publish),
                    ),
                  if (status == 'PUBLISHED')
                    OutlinedButton(
                      onPressed: changing
                          ? null
                          : () => eventAction('unpublish'),
                      child: Text(l10n.unpublish),
                    ),
                  if (editable)
                    OutlinedButton(
                      onPressed: changing ? null : () => eventAction('cancel'),
                      child: Text(l10n.cancelEvent),
                    ),
                  OutlinedButton(
                    onPressed: changing ? null : () => eventAction('duplicate'),
                    child: Text(l10n.duplicate),
                  ),
                ],
              ),
              OrganizerSeating(api: widget.api, event: event, editable: editable && !changing, onChanged: reload),
              const SizedBox(height: 20),
              Text(
                l10n.ticketTypes,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (editable)
                TextButton(
                  onPressed: changing ? null : () => editTicket(),
                  child: Text(l10n.addTicketType),
                ),
              if (types is! List || types.isEmpty)
                Text(l10n.noTicketTypes)
              else
                for (final type in types.whereType<Map<String, dynamic>>())
                  Card(
                    child: ListTile(
                      title: Text('${type['name'] ?? ''}'),
                      onTap: editable && !changing
                          ? () => editTicket(type)
                          : null,
                      subtitle: type['sold'] is int && type['available'] is int
                          ? Text(
                              '${l10n.ticketInventory(type['sold'] as int, type['available'] as int)}'
                              '${type['isHidden'] == true ? ' · ${l10n.hidden}' : ''}',
                            )
                          : null,
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (type['priceKzt'] is int)
                            Text(l10n.money(type['priceKzt'] as int)),
                          if (editable && type['id'] is String)
                            IconButton(
                              tooltip: l10n.deleteTicketType,
                              onPressed: changing
                                  ? null
                                  : () => deleteTicket(type['id'] as String),
                              icon: const Icon(Icons.delete_outline),
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
  final formats = Localizations.of<MaterialLocalizations>(
    context,
    MaterialLocalizations,
  );
  if (formats == null) return '';
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
