import 'package:material_ui/material_ui.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/event_card.dart';

typedef EditorField = ({String key, String label, bool required, bool number});

class OrganizerEditor extends StatefulWidget {
  const OrganizerEditor({
    super.key,
    required this.title,
    required this.fields,
    required this.initial,
    required this.save,
    this.eventApi,
    this.ticketTypes = const [],
  });

  final String title;
  final List<EditorField> fields;
  final Map<String, dynamic> initial;
  final Future<Object?> Function(Map<String, dynamic>) save;
  final ApiClient? eventApi;
  final List<Map> ticketTypes;

  @override
  State<OrganizerEditor> createState() => _OrganizerEditorState();
}

class _OrganizerEditorState extends State<OrganizerEditor> {
  final form = GlobalKey<FormState>();
  late final controllers = {
    for (final field in widget.fields)
      field.key: TextEditingController(
        text: '${widget.initial[field.key] ?? ''}',
      ),
  };
  late final String zone =
      widget.initial['timezone'] as String? ?? 'Asia/Almaty';
  late final tz.Location? location = eventLocation(zone);
  late Future<Map<String, dynamic>>? venues = widget.eventApi?.get(
    '/api/organizer/venues',
  );
  String? city;
  bool saving = false;
  String? error;

  String tr(String en, String ru, String kk) =>
      switch (AppLocalizations.of(context).locale.languageCode) {
        'ru' => ru,
        'kk' => kk,
        _ => en,
      };

  String value(String key) => controllers[key]?.text.trim() ?? '';

  String dateLabel(String key) {
    final instant = DateTime.tryParse(value(key));
    final eventZone = location;
    if (instant == null || eventZone == null) return '';
    final wall = tz.TZDateTime.from(instant, eventZone);
    final material = MaterialLocalizations.of(context);
    return '${material.formatMediumDate(wall)} · ${material.formatTimeOfDay(TimeOfDay.fromDateTime(wall), alwaysUse24HourFormat: true)}';
  }

  Future<void> pickDate(String key) async {
    final eventZone = location;
    if (eventZone == null) return;
    final wall = tz.TZDateTime.from(
      DateTime.tryParse(value(key)) ?? DateTime.now(),
      eventZone,
    );
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime(wall.year, wall.month, wall.day),
      firstDate: DateTime(wall.year < 1900 ? wall.year : 1900),
      lastDate: DateTime(wall.year > 2200 ? wall.year : 2200, 12, 31),
    );
    if (!mounted || date == null) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(wall),
    );
    if (!mounted || time == null) return;
    final instant = tz.TZDateTime(
      eventZone,
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute,
    );
    if (instant.hour != time.hour ||
        instant.minute != time.minute ||
        instant.day != date.day) {
      setState(
        () => error = tr(
          'That time does not exist in this timezone.',
          'Такого времени нет в этом часовом поясе.',
          'Бұл уақыт осы уақыт белдеуінде жоқ.',
        ),
      );
      return;
    }
    setState(() {
      controllers[key]!.text = instant.toUtc().toIso8601String();
      error = null;
    });
  }

  Map? selectedVenue(List<Map> options) {
    for (final venue in options) {
      if (venue['id'] == value('venueId')) return venue;
    }
    return null;
  }

  void preview(List<Map> options) {
    final l10n = AppLocalizations.of(context);
    final title = value('title');
    final description = value('description');
    final category = value('category');
    final start = dateLabel('startsAt');
    final venue = selectedVenue(options);
    final cover = EventCover.resolve(
      widget.eventApi!.base,
      value('coverImageUrl'),
    );
    Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (context) => Scaffold(
          appBar: AppBar(title: Text(l10n.preview)),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  height: 190,
                  child: EventCover(image: cover, category: category),
                ),
              ),
              const SizedBox(height: 16),
              if (category.isNotEmpty)
                Text(
                  l10n.categoryName(category),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              Text(
                title.isEmpty ? l10n.eventTitle : title,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              if (start.isNotEmpty)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event_outlined),
                  title: Text(start),
                  subtitle: Text(zone),
                ),
              if (venue != null)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.place_outlined),
                  title: Text('${venue['name']}'),
                  subtitle: Text(
                    '${venue['address']} · ${l10n.cityName('${venue['city']}')}',
                  ),
                ),
              if (description.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(description),
                ),
              Text(
                l10n.ticketTypes,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              for (final ticket in widget.ticketTypes.where(
                (ticket) => ticket['isHidden'] != true,
              ))
                Card(
                  child: ListTile(
                    title: Text(l10n.ticketTypeName('${ticket['name']}')),
                    trailing: Text(
                      l10n.money((ticket['priceKzt'] as num?)?.round() ?? 0),
                    ),
                  ),
                ),
              if (!widget.ticketTypes.any(
                (ticket) => ticket['isHidden'] != true,
              ))
                Text(l10n.noTicketTypes),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    for (final controller in controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    if (saving || !form.currentState!.validate()) return;
    if (widget.eventApi != null) {
      final start = DateTime.tryParse(value('startsAt'));
      final end = DateTime.tryParse(value('endsAt'));
      if (start == null || end == null || !end.isAfter(start)) {
        setState(
          () => error = tr(
            'End time must be after start time.',
            'Окончание должно быть позже начала.',
            'Аяқталу уақыты басталу уақытынан кейін болуы керек.',
          ),
        );
        return;
      }
    }
    final payload = Map<String, dynamic>.of(widget.initial);
    for (final field in widget.fields) {
      final input = value(field.key);
      if (input.isEmpty && field.number) {
        payload.remove(field.key);
      } else if (input.isEmpty &&
          {'venueId', 'coverImageUrl', 'category'}.contains(field.key)) {
        payload[field.key] = null;
      } else {
        payload[field.key] = field.number ? int.parse(input) : input;
      }
    }
    setState(() {
      saving = true;
      error = null;
    });
    try {
      await widget.save(payload);
      if (mounted) Navigator.pop(context, true);
    } catch (failure) {
      if (!mounted) return;
      setState(() {
        saving = false;
        error = AppLocalizations.of(context)
            .apiError(failure is ApiException ? failure.code : '');
      });
    }
  }

  Widget field(
    EditorField field,
    List<Map> options,
    AsyncSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final l10n = AppLocalizations.of(context);
    final key = field.key;
    Widget select(
      String label,
      Map<String, String> items,
      String selected,
      ValueChanged<String?> change,
    ) => DropdownButtonFormField<String>(
      key: ValueKey((label, selected)),
      initialValue: selected,
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: items.entries
          .map(
            (item) => DropdownMenuItem(
              value: item.key,
              child: Text(item.value, overflow: TextOverflow.ellipsis),
            ),
          )
          .toList(),
      onChanged: saving ? null : change,
    );
    if (key == 'category') {
      return select(
        field.label,
        {
          '': tr('No category', 'Без категории', 'Санатсыз'),
          for (final name in {
            'Music',
            'Community',
            'Technology',
            'Film',
            if (value(key).isNotEmpty) value(key),
          })
            name: l10n.categoryName(name),
        },
        value(key),
        (next) => setState(() => controllers[key]!.text = next ?? ''),
      );
    }
    if (key == 'visibility') {
      final choices = {
        'PUBLIC': tr('Public', 'Открытое', 'Ашық'),
        'UNLISTED': tr('Link only', 'По ссылке', 'Сілтеме арқылы'),
        'PRIVATE': tr('Private', 'Закрытое', 'Жабық'),
      };
      return select(
        field.label,
        choices,
        choices.containsKey(value(key)) ? value(key) : 'PUBLIC',
        (next) => setState(() => controllers[key]!.text = next ?? 'PUBLIC'),
      );
    }
    if (key == 'venueId') {
      final current = selectedVenue(options);
      final selectedCity = city ?? current?['city'] as String? ?? '';
      if (snapshot.connectionState == ConnectionState.waiting) {
        return const LinearProgressIndicator();
      }
      if (snapshot.hasError) {
        return TextButton.icon(
          onPressed: saving
              ? null
              : () => setState(
                  () => venues = widget.eventApi!.get('/api/organizer/venues'),
                ),
          icon: const Icon(Icons.refresh),
          label: Text(
            tr(
              'Reload venues',
              'Загрузить площадки',
              'Өтетін орындарды жүктеу',
            ),
          ),
        );
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          select(
            l10n.city,
            {
              '': l10n.allCities,
              for (final row in options)
                '${row['city']}': l10n.cityName('${row['city']}'),
            },
            selectedCity,
            (next) => setState(() => city = next),
          ),
          const SizedBox(height: 12),
          select(
            tr('Venue', 'Площадка', 'Өтетін орын'),
            {
              '': tr('No venue', 'Без площадки', 'Өтетін орын көрсетілмеген'),
              if (current == null && value(key).isNotEmpty)
                value(key): tr(
                  'Current venue',
                  'Текущая площадка',
                  'Ағымдағы орын',
                ),
              for (final row in options)
                if (selectedCity.isEmpty ||
                    row['city'] == selectedCity ||
                    row['id'] == value(key))
                  '${row['id']}':
                      '${row['name']} · ${l10n.cityName('${row['city']}')}',
            },
            value(key),
            (next) => setState(() => controllers[key]!.text = next ?? ''),
          ),
          if (current != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('${current['address']}'),
            ),
        ],
      );
    }
    if (key == 'startsAt' || key == 'endsAt') {
      return ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(field.label),
        subtitle: Text(
          dateLabel(key).isEmpty ? zone : '${dateLabel(key)} · $zone',
        ),
        trailing: const Icon(Icons.edit_calendar_outlined),
        onTap: saving || location == null ? null : () => pickDate(key),
      );
    }
    return TextFormField(
      controller: controllers[key],
      enabled: !saving,
      decoration: InputDecoration(
        labelText: key == 'coverImageUrl'
            ? tr(
                'Cover image URL',
                'Ссылка на обложку',
                'Мұқаба суретінің сілтемесі',
              )
            : field.label,
      ),
      minLines: key == 'description' ? 3 : 1,
      maxLines: key == 'description' ? 6 : 1,
      keyboardType: field.number
          ? TextInputType.number
          : key == 'coverImageUrl'
          ? TextInputType.url
          : null,
      validator: (raw) {
        final input = raw?.trim() ?? '';
        if (input.isEmpty) return field.required ? l10n.requiredField : null;
        if (field.number && int.tryParse(input) == null) {
          return l10n.wholeNumber;
        }
        if (key == 'coverImageUrl' && input != widget.initial[key]) {
          final uri = Uri.tryParse(input);
          if (uri == null ||
              uri.scheme != 'https' ||
              uri.host.isEmpty ||
              uri.userInfo.isNotEmpty) {
            return tr(
              'Enter an HTTPS image URL.',
              'Введите HTTPS-ссылку на изображение.',
              'Суреттің HTTPS сілтемесін енгізіңіз.',
            );
          }
        }
        return null;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PopScope(
      canPop: !saving,
      child: Scaffold(
        appBar: AppBar(title: Text(widget.title)),
        body: FutureBuilder(
          future: venues,
          builder: (context, snapshot) {
            final options =
                (snapshot.data?['venues'] as List?)
                    ?.whereType<Map>()
                    .toList() ??
                <Map>[];
            return Form(
              key: form,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  for (final item in widget.fields)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: field(item, options, snapshot),
                    ),
                  if (error != null)
                    Text(
                      error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  if (widget.eventApi != null)
                    OutlinedButton(
                      onPressed: saving ? null : () => preview(options),
                      child: Text(l10n.preview),
                    ),
                  FilledButton(
                    onPressed: saving ? null : submit,
                    child: Text(saving ? l10n.saving : l10n.save),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

tz.Location? eventLocation(String name) {
  if (tz.timeZoneDatabase.locations.isEmpty) tzdata.initializeTimeZones();
  return tz.timeZoneDatabase.locations[name];
}
