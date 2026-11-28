import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';

String seatText(BuildContext context, String en, String ru, String kk) =>
    switch (AppLocalizations.of(context).locale.languageCode) {
      'ru' => ru,
      'kk' => kk,
      _ => en,
    };

class OrganizerSeating extends StatefulWidget {
  const OrganizerSeating({super.key, required this.api, required this.event,
    required this.editable, required this.onChanged});
  final ApiClient api;
  final Map<String, dynamic> event;
  final bool editable;
  final VoidCallback onChanged;

  @override
  State<OrganizerSeating> createState() => _OrganizerSeatingState();
}

class _OrganizerSeatingState extends State<OrganizerSeating> {
  String get path => '/api/organizer/events/${Uri.encodeComponent(widget.event['id'] as String)}';
  bool busy = false;

  Future<void> configure() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final result = await widget.api.get('/api/organizer/venues');
      if (!mounted) return;
      final venues = (result['venues'] as List).whereType<Map<String, dynamic>>().toList();
      String? venue = widget.event['venueId'] as String?;
      String mode = widget.event['seatingMode'] == 'ASSIGNED' ? 'ASSIGNED' : 'GENERAL_ADMISSION';
      final selected = await showDialog<Map<String, dynamic>>(
        context: context,
        builder: (context) => StatefulBuilder(builder: (context, update) {
          final l10n = AppLocalizations.of(context);
          return AlertDialog(
            title: Text(seatText(context, 'Seating settings', 'Настройки рассадки', 'Отыру параметрлері')),
            content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
              DropdownButton<String>(
                isExpanded: true,
                value: venues.any((v) => v['id'] == venue) ? venue : null,
                hint: Text(seatText(context, 'Select venue', 'Выберите площадку', 'Залды таңдаңыз')),
                items: [for (final v in venues) DropdownMenuItem(value: v['id'] as String, child: Text('${v['name']} (${v['city']})', overflow: TextOverflow.ellipsis))],
                onChanged: (value) => update(() => venue = value),
              ),
              DropdownButton<String>(
                isExpanded: true,
                value: mode,
                items: [
                  DropdownMenuItem(value: 'GENERAL_ADMISSION', child: Text(seatText(context, 'General admission', 'Свободная рассадка', 'Еркін орындар'))),
                  DropdownMenuItem(value: 'ASSIGNED', child: Text(seatText(context, 'Assigned seating', 'Места по номерам', 'Нөмірленген орындар'))),
                ],
                onChanged: (value) => update(() => mode = value!),
              ),
            ])),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: Text(l10n.cancel)),
              FilledButton(onPressed: mode == 'ASSIGNED' && venue == null ? null : () => Navigator.pop(context, <String, dynamic>{'seatingMode': mode, if (venue != null) 'venueId': venue}), child: Text(l10n.save)),
            ],
          );
        }),
      );
      if (!mounted || selected == null) return;
      final current = (await widget.api.get(path))['event'] as Map<String, dynamic>;
      final payload = <String, dynamic>{
        for (final key in ['title', 'description', 'category', 'coverImageUrl', 'startsAt', 'endsAt', 'registrationOpensAt', 'registrationClosesAt', 'capacity', 'timezone', 'refundPolicy', 'visibility'])
          if (current[key] != null) key: current[key],
        ...selected,
      };
      await widget.api.put(path, payload);
      if (mounted) widget.onChanged();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(
        error is ApiException && error.status == 409
          ? seatText(context, 'Seating cannot change after orders exist.', 'Нельзя изменить рассадку после заказов.', 'Тапсырыстардан кейін отыру түрін өзгертуге болмайды.')
          : AppLocalizations.of(context).apiError(error is ApiException ? error.code : ''),
        )));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final assigned = widget.event['seatingMode'] == 'ASSIGNED';
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(assigned ? seatText(context, 'Assigned seating', 'Места по номерам', 'Нөмірленген орындар') : seatText(context, 'General admission', 'Свободная рассадка', 'Еркін орындар')),
      if (widget.editable) OutlinedButton(onPressed: busy ? null : configure, child: Text(seatText(context, 'Seating settings', 'Настройки рассадки', 'Отыру параметрлері'))),
      if (assigned && widget.event['venueId'] != null)
        OutlinedButton(onPressed: busy ? null : () => Navigator.push(context, MaterialPageRoute(builder: (_) => OrganizerSeatMap(api: widget.api, path: path, editable: widget.editable))), child: Text(seatText(context, 'Seat map', 'Карта мест', 'Орындар картасы'))),
    ]);
  }
}

List<Map<String, dynamic>> seatRows(Object? value) =>
    value is List ? value.whereType<Map<String, dynamic>>().toList() : [];

List<String>? parseSeatNumbers(String input) {
  final values = input.split(',').map((s) => s.trim()).toList();
  if (values.length > 200 || values.any((s) => s.isEmpty || s.length > 20) || values.toSet().length != values.length) return null;
  return values;
}

bool canDeleteSeat(Map<String, dynamic> seat) => seat['status'] == 'AVAILABLE';

class OrganizerSeatMap extends StatefulWidget {
  const OrganizerSeatMap({super.key, required this.api, required this.path, required this.editable});
  final ApiClient api;
  final String path;
  final bool editable;
  @override
  State<OrganizerSeatMap> createState() => _OrganizerSeatMapState();
}

class _OrganizerSeatMapState extends State<OrganizerSeatMap> {
  late Future<Map<String, dynamic>> data;
  bool busy = false;
  bool denied = false;
  @override
  void initState() {
    super.initState();
    data = widget.api.get('${widget.path}/seats');
  }

  void refresh() => setState(() { denied = false; data = widget.api.get('${widget.path}/seats'); });

  Future<void> mutate(String suffix, {Map<String, dynamic>? body}) async {
    if (busy || denied || !widget.editable) return;
    setState(() => busy = true);
    try {
      if (body == null) {
        await widget.api.request('DELETE', '${widget.path}$suffix');
      } else {
        await widget.api.post('${widget.path}$suffix', body);
      }
      if (mounted) refresh();
    } catch (error) {
      if (!mounted) return;
      if (error is ApiException && error.status == 403) setState(() => denied = true);
      if (error is ApiException && (error.status == 404 || error.status == 409)) refresh();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(
        error is ApiException && error.status == 403
          ? seatText(context, 'Shared venue: only the platform admin can edit.', 'Общий зал может редактировать только администратор.', 'Ортақ залды тек әкімші өңдей алады.')
          : error is ApiException && error.status == 409
            ? seatText(context, 'Seat or label is already in use.', 'Место или название уже используется.', 'Орын немесе атау қолданыста.')
            : AppLocalizations.of(context).apiError(error is ApiException ? error.code : ''),
      )));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> add(String suffix, {required bool section, required bool row}) async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context, builder: (_) => _SeatInput(section: section, row: row),
    );
    if (mounted && result != null) await mutate(suffix, body: result);
  }

  Future<void> remove(String id) async {
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: Text(seatText(context, 'Delete seat?', 'Удалить место?', 'Орынды жою керек пе?')),
      content: Text(seatText(context, 'This removes the seat from the venue map.', 'Место будет удалено из карты зала.', 'Орын зал картасынан жойылады.')),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: Text(AppLocalizations.of(context).cancel)),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(AppLocalizations.of(context).delete)),
      ],
    ));
    if (mounted && confirmed == true) await mutate('/seats/${Uri.encodeComponent(id)}');
  }

  String statusLabel(String status) => switch (status) {
    'AVAILABLE' => seatText(context, 'Available', 'Свободно', 'Бос'),
    'HELD' => seatText(context, 'Held', 'Забронировано', 'Брондалған'),
    'SOLD' => seatText(context, 'Sold', 'Продано', 'Сатылған'),
    _ => seatText(context, 'Unavailable', 'Недоступно', 'Қолжетімсіз'),
  };

  Color statusColor(String status) => switch (status) {
    'AVAILABLE' => Colors.green,
    'HELD' => Colors.orange,
    'SOLD' => Colors.red,
    _ => Colors.grey,
  };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final edit = widget.editable && !denied;
    return Scaffold(
      appBar: AppBar(title: Text(seatText(context, 'Seat map', 'Карта мест', 'Орындар картасы')), actions: [IconButton(onPressed: busy ? null : refresh, tooltip: l10n.refresh, icon: const Icon(Icons.refresh))]),
      body: FutureBuilder(
        future: data,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const LoadingState();
          if (snapshot.hasError || snapshot.data?['sections'] is! List) return ErrorState(message: l10n.apiError(''), onRetry: refresh, retryLabel: l10n.refresh);
          final sections = seatRows(snapshot.data!['sections']);
          final seats = sections.expand((s) => seatRows(s['rows'])).expand((r) => seatRows(r['seats'])).toList();
          return ListView(padding: const EdgeInsets.all(16), children: [
            Text(seatText(context, 'Shared venues can only be edited by a platform admin.', 'Общие залы редактирует только администратор.', 'Ортақ залды тек әкімші өңдейді.')),
            Wrap(spacing: 8, children: [
              for (final status in ['AVAILABLE', 'HELD', 'SOLD', 'UNAVAILABLE'])
                Chip(label: Text('${statusLabel(status)}: ${seats.where((s) => s['status'] == status).length}'), side: BorderSide(color: statusColor(status))),
            ]),
            for (final section in sections) Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${section['name']}', style: Theme.of(context).textTheme.titleLarge),
              for (final row in seatRows(section['rows'])) ...[
                Text('${seatText(context, 'Row', 'Ряд', 'Қатар')} ${row['label']}'),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final seat in seatRows(row['seats']))
                    Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(border: Border.all(color: statusColor('${seat['status']}')), borderRadius: BorderRadius.circular(8)), child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Text('${seat['number']}${seat['isAccessible'] == true ? ' *' : ''}'),
                      Text(statusLabel('${seat['status']}')),
                      if (edit && canDeleteSeat(seat)) IconButton(tooltip: l10n.delete, onPressed: busy ? null : () => remove(seat['id'] as String), icon: const Icon(Icons.delete_outline)),
                    ])),
                ]),
                if (edit) TextButton(onPressed: busy ? null : () => add('/rows/${Uri.encodeComponent(row['id'] as String)}/seats', section: false, row: false), child: Text(seatText(context, 'Add seats', 'Добавить места', 'Орын қосу'))),
              ],
              if (edit) OutlinedButton(onPressed: busy ? null : () => add('/sections/${Uri.encodeComponent(section['id'] as String)}/rows', section: false, row: true), child: Text(seatText(context, 'Add row and seats', 'Добавить ряд и места', 'Қатар мен орын қосу'))),
            ]))),
            if (edit) FilledButton(onPressed: busy ? null : () => add('/sections', section: true, row: false), child: Text(seatText(context, 'Add section', 'Добавить секцию', 'Сектор қосу'))),
          ]);
        },
      ),
    );
  }
}

class _SeatInput extends StatefulWidget {
  const _SeatInput({required this.section, required this.row});
  final bool section;
  final bool row;
  @override
  State<_SeatInput> createState() => _SeatInputState();
}

class _SeatInputState extends State<_SeatInput> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController();
  final numbers = TextEditingController();
  bool accessible = false;
  @override
  void dispose() { name.dispose(); numbers.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(widget.section ? seatText(context, 'Add section', 'Добавить секцию', 'Сектор қосу') : seatText(context, 'Add seats', 'Добавить места', 'Орын қосу')),
      content: Form(key: form, child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        if (widget.section || widget.row) TextFormField(controller: name, maxLength: widget.section ? 80 : 20, decoration: InputDecoration(labelText: widget.section ? seatText(context, 'Section name', 'Название секции', 'Сектор атауы') : seatText(context, 'Row label', 'Название ряда', 'Қатар атауы')), validator: (v) => v == null || v.trim().isEmpty ? l10n.requiredField : null),
        if (!widget.section) ...[
          TextFormField(controller: numbers, decoration: InputDecoration(labelText: seatText(context, 'Seat numbers (comma separated)', 'Номера через запятую', 'Нөмірлер үтір арқылы')), validator: (v) => parseSeatNumbers(v ?? '') == null ? seatText(context, 'Enter 1–200 unique numbers (max 20 characters).', 'Введите 1–200 уникальных номеров (до 20 символов).', '1–200 бірегей нөмір енгізіңіз (20 таңбаға дейін).') : null),
          CheckboxListTile(value: accessible, onChanged: (v) => setState(() => accessible = v ?? false), title: Text(seatText(context, 'Accessible seats', 'Доступные для МГН места', 'Бейімделген орындар'))),
        ],
      ]))),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(l10n.cancel)),
        FilledButton(onPressed: () {
          if (!form.currentState!.validate()) return;
          Navigator.pop(context, <String, dynamic>{
            if (widget.section) 'name': name.text.trim(),
            if (widget.row) 'label': name.text.trim(),
            if (!widget.section) 'seats': [for (final number in parseSeatNumbers(numbers.text)!) {'number': number, 'isAccessible': accessible}],
          });
        }, child: Text(l10n.save)),
      ],
    );
  }
}
