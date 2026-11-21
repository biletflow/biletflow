import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';
import '../widgets/quantity_stepper.dart';
import 'checkout.dart';

class EventDetailScreen extends StatefulWidget {
  final ApiClient api;
  final String slug;
  const EventDetailScreen({super.key, required this.api, required this.slug});

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  Map<String, dynamic>? _event;
  final Map<String, int> _quantities = {};
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
      final data = await widget.api.get('/api/events/${widget.slug}');
      final event = data['event'];
      if (event is! Map) {
        throw const ApiException(500, 'INVALID_EVENT_RESPONSE');
      }
      setState(() {
        _event = Map<String, dynamic>.from(event);
        _quantities.clear();
      });
    } on ApiException catch (error) {
      setState(() => _error = error.code);
    } catch (_) {
      setState(() => _error = 'REQUEST_FAILED');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _selectedCount() =>
      _quantities.values.fold<int>(0, (sum, value) => sum + value);

  void _setQuantity(String id, int next, int maxPerOrder, int available) {
    final capped = next.clamp(0, maxPerOrder < available ? maxPerOrder : available);
    setState(() {
      if (capped <= 0) {
        _quantities.remove(id);
      } else {
        _quantities[id] = capped;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final event = _event;
    final venue = event?['venue'];
    final organizer = event?['organizer'];
    final ticketTypes = event?['ticketTypes'];
    final title = '${event?['title'] ?? 'Event'}';
    final soldOut = event?['isSoldOut'] == true;
    final selected = _selectedCount();

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: _loading
          ? const LoadingState()
          : _error != null
              ? ErrorState(
                  message: l10n.apiError(_error!),
                  onRetry: _load,
                  retryLabel: l10n.refresh,
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(title, style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 8),
                    if (event?['category'] != null)
                      Text('${event!['category']}'),
                    if (event?['startsAt'] != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text('${event!['startsAt']}'),
                      ),
                    if (venue is Map)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          [
                            '${venue['name'] ?? ''}',
                            '${venue['address'] ?? ''}',
                            '${venue['city'] ?? ''}',
                          ].where((part) => part.isNotEmpty).join(' · '),
                        ),
                      ),
                    if (organizer is Map)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(l10n.organizer('${organizer['name'] ?? ''}')),
                      ),
                    if (event?['description'] != null) ...[
                      const SizedBox(height: 16),
                      Text('${event!['description']}'),
                    ],
                    const SizedBox(height: 20),
                    Text(l10n.tickets, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    if (soldOut)
                      Text(l10n.soldOut)
                    else if (ticketTypes is! List || ticketTypes.isEmpty)
                      Text(l10n.noTicketTypes)
                    else
                      ...ticketTypes.whereType<Map>().map((raw) {
                        final type = Map<String, dynamic>.from(raw);
                        final id = '${type['id'] ?? ''}';
                        if (id.isEmpty) return const SizedBox.shrink();
                        final price = type['priceKzt'];
                        final available = type['available'] is num
                            ? (type['available'] as num).toInt()
                            : 0;
                        final maxPerOrder = type['maxPerOrder'] is num
                            ? (type['maxPerOrder'] as num).toInt()
                            : available;
                        final qty = _quantities[id] ?? 0;
                        final priceLabel = price is num
                            ? (price == 0 ? l10n.free : '₸${price.round()}')
                            : '';
                        final disabled = available <= 0;
                        return Card(
                          child: ListTile(
                            title: Text('${type['name'] ?? ''}'),
                            subtitle: Text(
                              [
                                priceLabel,
                                if (available > 0) l10n.left(available) else l10n.soldOut,
                              ].where((part) => part.isNotEmpty).join(' · '),
                            ),
                            trailing: disabled
                                ? null
                                : QuantityStepper(
                                    value: qty,
                                    max: maxPerOrder < available
                                        ? maxPerOrder
                                        : available,
                                    onChanged: (next) => _setQuantity(
                                      id,
                                      next,
                                      maxPerOrder,
                                      available,
                                    ),
                                  ),
                          ),
                        );
                      }),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: selected > 0
                          ? () {
                              final eventId = '${event?['id'] ?? ''}';
                              if (eventId.isEmpty || ticketTypes is! List) return;
                              final lines = <CheckoutLine>[];
                              for (final raw in ticketTypes.whereType<Map>()) {
                                final type = Map<String, dynamic>.from(raw);
                                final id = '${type['id'] ?? ''}';
                                final qty = _quantities[id] ?? 0;
                                if (id.isEmpty || qty <= 0) continue;
                                final price = type['priceKzt'];
                                lines.add(
                                  CheckoutLine(
                                    ticketTypeId: id,
                                    name: '${type['name'] ?? 'Ticket'}',
                                    priceKzt: price is num ? price.toInt() : 0,
                                    quantity: qty,
                                  ),
                                );
                              }
                              if (lines.isEmpty) return;
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => CheckoutScreen(
                                    api: widget.api,
                                    eventId: eventId,
                                    eventTitle: title,
                                    lines: lines,
                                  ),
                                ),
                              );
                            }
                          : null,
                      child: Text(
                        selected > 0
                            ? l10n.continueWithTickets(selected)
                            : l10n.selectTickets,
                      ),
                    ),
                  ],
                ),
    );
  }
}
