import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../l10n/locale_controller.dart';
import '../theme/biletflow_theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/empty_state.dart';
import '../widgets/event_card.dart';
import '../widgets/locale_switcher.dart';
import 'event_detail.dart';

class EventsCatalogScreen extends StatefulWidget {
  const EventsCatalogScreen({super.key, required this.api, this.locales});
  final ApiClient api;
  final LocaleController? locales;

  @override
  State<EventsCatalogScreen> createState() => _EventsCatalogScreenState();
}

class _EventsCatalogScreenState extends State<EventsCatalogScreen> {
  final _query = TextEditingController();
  List<Map<String, dynamic>> _events = [];
  List<String> _cities = [];
  List<String> _categories = [];
  String? _city;
  String? _category;
  String? _price;
  String? _error;
  bool _loading = true;
  int _request = 0;

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
    final request = ++_request;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.api.get(
        '/api/events',
        query: {
          'query': _query.text.trim(),
          if (_city != null) 'city': _city!,
          if (_category != null) 'category': _category!,
          if (_price != null) 'price': _price!,
          'sort': 'date',
        },
      );
      if (!mounted || request != _request) return;
      final events = data['events'];
      final cities = data['cities'];
      final categories = data['categories'];
      setState(() {
        _events = events is List
            ? events.whereType<Map<String, dynamic>>().toList()
            : [];
        _cities = cities is List ? cities.whereType<String>().toList() : [];
        _categories = categories is List
            ? categories
                  .whereType<Map>()
                  .map((row) => row['category'])
                  .whereType<String>()
                  .toList()
            : [];
      });
    } on ApiException catch (error) {
      if (mounted && request == _request) setState(() => _error = error.code);
    } catch (_) {
      if (mounted && request == _request) {
        setState(() => _error = 'REQUEST_FAILED');
      }
    } finally {
      if (mounted && request == _request) setState(() => _loading = false);
    }
  }

  String _priceLabel(AppLocalizations l10n, Map<String, dynamic> row) {
    if (row['isSoldOut'] == true) return l10n.soldOut;
    if (row['isFree'] == true) return l10n.free;
    final min = row['minPriceKzt'];
    return min is num ? l10n.fromPrice(min.round()) : '';
  }

  void _search() {
    FocusScope.of(context).unfocus();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locales = widget.locales;

    Widget filter(
      String? current,
      String all,
      Map<String, String> options,
      void Function(String?) select,
    ) => PopupMenuButton<String>(
      initialValue: current ?? '',
      onSelected: (value) {
        select(value.isEmpty ? null : value);
        _search();
      },
      itemBuilder: (_) => [
        PopupMenuItem(value: '', child: Text(all)),
        for (final option in options.entries)
          PopupMenuItem(value: option.key, child: Text(option.value)),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        constraints: const BoxConstraints(minHeight: 48),
        decoration: BoxDecoration(
          color: current == null ? Colors.white : BiletFlowColors.brandTint,
          border: Border.all(color: BiletFlowColors.ink300),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                options[current] ?? all,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const Icon(Icons.expand_more, size: 18),
          ],
        ),
      ),
    );

    return Scaffold(
      appBar: AppBar(
        title: const BrandMark(),
        actions: [if (locales != null) LocaleSwitcher(controller: locales)],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: DecoratedBox(
                decoration: const BoxDecoration(gradient: BiletFlowColors.hero),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 680),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 30, 20, 26),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(text: '${l10n.heroTitle}\n'),
                                TextSpan(
                                  text: l10n.heroAccent,
                                  style: const TextStyle(
                                    color: BiletFlowColors.sky,
                                  ),
                                ),
                              ],
                            ),
                            style: theme.textTheme.headlineLarge?.copyWith(
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 20),
                          TextField(
                            controller: _query,
                            textInputAction: TextInputAction.search,
                            decoration: InputDecoration(
                              hintText: l10n.searchEvents,
                              prefixIcon: const Icon(Icons.search),
                              suffixIcon: IconButton(
                                tooltip: l10n.search,
                                onPressed: _search,
                                icon: const Icon(
                                  Icons.arrow_forward,
                                  color: BiletFlowColors.brand,
                                ),
                              ),
                            ),
                            onSubmitted: (_) => _search(),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        filter(_city, l10n.allCities, {
                          for (final city in _cities) city: l10n.cityName(city),
                        }, (value) => _city = value),
                        filter(_category, l10n.allCategories, {
                          for (final category in _categories)
                            category: l10n.categoryName(category),
                        }, (value) => _category = value),
                        filter(_price, l10n.anyPrice, {
                          'free': l10n.free,
                          'under10k': l10n.under10k,
                          'over10k': l10n.over10k,
                        }, (value) => _price = value),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Text(
                      _city == null &&
                              _category == null &&
                              _price == null &&
                              _query.text.trim().isEmpty
                          ? l10n.upcoming
                          : l10n.browseEvents,
                      style: theme.textTheme.headlineSmall,
                    ),
                  ],
                ),
              ),
            ),
            if (_loading)
              const SliverToBoxAdapter(child: LinearProgressIndicator())
            else if (_error != null)
              SliverToBoxAdapter(
                child: ErrorState(
                  message: l10n.apiError(_error!),
                  onRetry: _load,
                  retryLabel: l10n.refresh,
                ),
              )
            else if (_events.isEmpty)
              SliverToBoxAdapter(
                child: EmptyState(
                  icon: Icons.event_busy_outlined,
                  title: l10n.noEvents,
                ),
              ),
            if (!_loading && _error == null)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                sliver: SliverGrid.builder(
                  gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 440,
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 14,
                    mainAxisExtent:
                        160 + MediaQuery.textScalerOf(context).scale(105),
                  ),
                  itemCount: _events.length,
                  itemBuilder: (context, index) {
                    final event = _events[index];
                    final slug = event['slug'];
                    return EventCard.fromJson(
                      event,
                      base: widget.api.base,
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
      ),
    );
  }
}
