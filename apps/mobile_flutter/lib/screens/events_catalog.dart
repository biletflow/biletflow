import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
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

  String _priceLabel(Map row) {
    final free = row['isFree'] == true;
    final soldOut = row['isSoldOut'] == true;
    if (soldOut) return 'Sold out';
    if (free) return 'Free';
    final min = row['minPriceKzt'];
    if (min is num) return 'from ₸${min.round()}';
    return '';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Browse events')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _query,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Search events, venues…',
                suffixIcon: IconButton(
                  tooltip: 'Search',
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
                    hint: const Text('City'),
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text('All cities'),
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
                    hint: const Text('Category'),
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text('All categories'),
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
                    hint: const Text('Price'),
                    items: const [
                      DropdownMenuItem<String?>(
                        value: null,
                        child: Text('Any price'),
                      ),
                      DropdownMenuItem<String?>(
                        value: 'free',
                        child: Text('Free'),
                      ),
                      DropdownMenuItem<String?>(
                        value: 'under10k',
                        child: Text('Under ₸10,000'),
                      ),
                      DropdownMenuItem<String?>(
                        value: 'over10k',
                        child: Text('₸10,000+'),
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
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          Expanded(
            child: _events.isEmpty && !_loading
                ? const Center(child: Text('No events found'))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _events.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final raw = _events[index];
                      if (raw is! Map) return const SizedBox.shrink();
                      final row = Map<String, dynamic>.from(raw);
                      final venue = row['venue'];
                      final city = venue is Map ? '${venue['city'] ?? ''}' : '';
                      final title = '${row['title'] ?? ''}';
                      final startsAt = '${row['startsAt'] ?? ''}';
                      final slug = row['slug'];
                      return Card(
                        child: ListTile(
                          title: Text(title),
                          subtitle: Text(
                            [
                              if (city.isNotEmpty) city,
                              if (startsAt.isNotEmpty) startsAt,
                              _priceLabel(row),
                            ].where((part) => part.isNotEmpty).join(' · '),
                          ),
                          trailing: const Icon(Icons.chevron_right),
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
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
