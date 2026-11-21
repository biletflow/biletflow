import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';
import '../widgets/event_card.dart';
import 'event_detail.dart';

class EventsCatalogScreen extends StatefulWidget {
  final ApiClient api;
  const EventsCatalogScreen({super.key, required this.api});

  @override
  State<EventsCatalogScreen> createState() => _EventsCatalogScreenState();
}

class _EventsCatalogScreenState extends State<EventsCatalogScreen> {
  final _query = TextEditingController();
  List<dynamic> _events = const [];
  List<String> _cities = const [];
  List<dynamic> _categories = const [];
  String? _city;
  String? _category;
  String? _price;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.api.get('/api/events', query: {
        'query': _query.text.trim(),
        if (_city != null) 'city': _city!,
        if (_category != null) 'category': _category!,
        if (_price != null) 'price': _price!,
        'sort': 'date',
      });
      final events = data['events'];
      final cities = data['cities'];
      final categories = data['categories'];
      setState(() {
        _events = events is List ? events : const [];
        _cities = cities is List
            ? cities.whereType<String>().toList(growable: false)
            : const [];
        _categories = categories is List ? categories : const [];
      });
    } on ApiException catch (error) {
      setState(() => _error = error.code);
    } catch (_) {
      setState(() => _error = 'REQUEST_FAILED');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _priceLabel(AppLocalizations l10n, Map row) {
    final free = row['isFree'] == true;
    final soldOut = row['isSoldOut'] == true;
    if (soldOut) return l10n.soldOut;
    if (free) return l10n.free;
    final min = row['minPriceKzt'];
    if (min is num) return l10n.fromPrice(min.round());
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.browseEvents)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _query,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: l10n.searchEvents,
                suffixIcon: IconButton(
                  tooltip: l10n.search,
                  onPressed: _load,
                  icon: const Icon(Icons.search),
                ),
              ),
              onSubmitted: (_) => _load(),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: DropdownButton<String?>(
                    value: _city,
                    hint: Text(l10n.city),
                    items: [
                      DropdownMenuItem<String?>(
                        value: null,
                        child: Text(l10n.allCities),
                      ),
                      ..._cities.map(
                        (city) => DropdownMenuItem<String?>(
                          value: city,
                          child: Text(city),
                        ),
                      ),
                    ],
                    onChanged: (value) {
                      setState(() => _city = value);
                      _load();
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: DropdownButton<String?>(
                    value: _category,
                    hint: Text(l10n.category),
                    items: [
                      DropdownMenuItem<String?>(
                        value: null,
                        child: Text(l10n.allCategories),
                      ),
                      ..._categories
                          .whereType<Map>()
                          .map((row) => '${row['category'] ?? ''}')
                          .where((value) => value.isNotEmpty)
                          .map(
                            (category) => DropdownMenuItem<String?>(
                              value: category,
                              child: Text(category),
                            ),
                          ),
                    ],
                    onChanged: (value) {
                      setState(() => _category = value);
                      _load();
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: DropdownButton<String?>(
                    value: _price,
                    hint: Text(l10n.price),
                    items: [
                      DropdownMenuItem<String?>(
                        value: null,
                        child: Text(l10n.anyPrice),
                      ),
                      DropdownMenuItem<String?>(
                        value: 'free',
                        child: Text(l10n.free),
                      ),
                      DropdownMenuItem<String?>(
                        value: 'under10k',
                        child: Text(l10n.under10k),
                      ),
                      DropdownMenuItem<String?>(
                        value: 'over10k',
                        child: Text(l10n.over10k),
                      ),
                    ],
                    onChanged: (value) {
                      setState(() => _price = value);
                      _load();
                    },
                  ),
                ),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(),
          Expanded(
            child: _error != null
                ? ErrorState(
                    message: l10n.apiError(_error!),
                    onRetry: _load,
                    retryLabel: l10n.refresh,
                  )
                : _events.isEmpty && !_loading
                    ? EmptyState(
                        icon: Icons.event_busy_outlined,
                        title: l10n.noEvents,
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _events.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final raw = _events[index];
                          if (raw is! Map) return const SizedBox.shrink();
                          final row = Map<String, dynamic>.from(raw);
                          final slug = row['slug'];
                          return EventCard.fromJson(
                            row,
                            priceLabel: (item) => _priceLabel(l10n, item),
                            onTap: slug is String
                                ? () => Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => EventDetailScreen(
                                          api: widget.api,
                                          slug: slug,
                                        ),
                                      ),
                                    )
                                : null,
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
