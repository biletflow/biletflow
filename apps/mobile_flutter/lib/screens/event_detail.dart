import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../l10n/app_localizations.dart';
import '../theme/biletflow_theme.dart';
import '../widgets/empty_state.dart';
import '../widgets/event_card.dart';
import '../widgets/quantity_stepper.dart';
import 'checkout.dart';
import '../widgets/refund_policy.dart';
import 'support.dart';

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
  final _campaign = TextEditingController();
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
      if (!mounted) return;
      setState(() {
        _event = Map<String, dynamic>.from(event);
        _quantities.clear();
      });
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.code);
    } catch (_) {
      if (mounted) setState(() => _error = 'REQUEST_FAILED');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _campaign.dispose();
    super.dispose();
  }

  int _selectedCount() =>
      _quantities.values.fold<int>(0, (sum, value) => sum + value);

  bool _withinWindow(Object? start, Object? end) {
    final opens = DateTime.tryParse(start?.toString() ?? '');
    final closes = DateTime.tryParse(end?.toString() ?? '');
    final now = DateTime.now();
    return (opens == null || !now.isBefore(opens)) &&
        (closes == null || !now.isAfter(closes));
  }

  void _setQuantity(String id, int next, int maxPerOrder, int available) {
    final capped = next.clamp(
      0,
      maxPerOrder < available ? maxPerOrder : available,
    );
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
    final title = '${event?['title'] ?? l10n.eventDetails}';
    final category = event?['category'] as String?;
    final registrationOpen =
        event?['status'] == 'PUBLISHED' &&
        _withinWindow(
          event?['registrationOpensAt'],
          event?['registrationClosesAt'],
        );
    final soldOut = event?['isSoldOut'] == true;
    final selected = _selectedCount();

    return Scaffold(
      appBar: AppBar(title: Text(l10n.eventDetails)),
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
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: SizedBox(
                    height: 180,
                    child: EventCover(
                      category: category,
                      image: EventCover.resolve(
                        widget.api.base,
                        event?['coverImageUrl'],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (category != null)
                  Text(
                    l10n.categoryName(category),
                    style: const TextStyle(
                      color: BiletFlowColors.brand,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                Text(title, style: Theme.of(context).textTheme.headlineSmall),
                if (event?['startsAt'] != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      formatEventWhen(event!['startsAt'], context: context),
                    ),
                  ),
                if (venue is Map)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      [
                        '${venue['name'] ?? ''}',
                        '${venue['address'] ?? ''}',
                        l10n.cityName('${venue['city'] ?? ''}'),
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
                RefundPolicyNotice(
                  policy: event?['refundPolicy'],
                  startsAt: event?['startsAt'],
                ),
                const SizedBox(height: 20),
                Text(
                  l10n.tickets,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                if (!registrationOpen)
                  Text(l10n.registrationUnavailable)
                else if (soldOut)
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
                        ? l10n.money(price.round())
                        : '';
                    final inWindow = _withinWindow(
                      type['salesStartAt'],
                      type['salesEndAt'],
                    );
                    final paidBlocked =
                        price is num &&
                        price > 0 &&
                        event?['paidSalesActive'] != true;
                    final disabled = available <= 0 || !inWindow || paidBlocked;
                    return Card(
                      child: ListTile(
                        title: Text(
                          l10n.ticketTypeName('${type['name'] ?? ''}'),
                        ),
                        subtitle: Text(
                          [
                            priceLabel,
                            if (paidBlocked)
                              l10n.paidSalesUnavailable
                            else if (!inWindow)
                              l10n.registrationUnavailable
                            else if (available > 0)
                              l10n.left(available)
                            else
                              l10n.soldOut,
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
                if (registrationOpen && !soldOut)
                  TextField(
                    controller: _campaign,
                    decoration: InputDecoration(
                      labelText: l10n.promoOrCampaign,
                    ),
                  ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: registrationOpen && selected > 0
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
                            if (!_withinWindow(
                              type['salesStartAt'],
                              type['salesEndAt'],
                            )) {
                              continue;
                            }
                            lines.add(
                              CheckoutLine(
                                ticketTypeId: id,
                                name: '${type['name'] ?? ''}',
                                priceKzt: price is num ? price.toInt() : 0,
                                quantity: qty,
                              ),
                            );
                          }
                          if (lines.isEmpty) return;
                          final link = _campaign.text.trim();
                          final token = campaignTokenFrom(link);
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => CheckoutScreen(
                                api: widget.api,
                                eventId: eventId,
                                eventTitle: title,
                                refundPolicy: event?['refundPolicy']
                                    ?.toString(),
                                eventStartsAt: event?['startsAt']?.toString(),
                                lines: lines,
                                initialCampaignToken: token,
                                initialPromoCode:
                                    token == null && link.isNotEmpty
                                    ? link
                                    : null,
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
                if (event?['id'] is String)
                  TextButton.icon(
                    icon: const Icon(Icons.support_agent),
                    label: Text(l10n.support),
                    onPressed: () async {
                      final caseId = await Navigator.push<String>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => SupportComposer(
                            api: widget.api,
                            eventId: event!['id'] as String,
                          ),
                        ),
                      );
                      if (!context.mounted || caseId == null) return;
                      await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              SupportThread(api: widget.api, id: caseId),
                        ),
                      );
                    },
                  ),
              ],
            ),
    );
  }
}
