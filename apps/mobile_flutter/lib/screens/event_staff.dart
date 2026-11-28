import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';

class EventStaffScreen extends StatefulWidget {
  const EventStaffScreen({super.key, required this.api, required this.eventId});
  final ApiClient api;
  final String eventId;
  @override
  State<EventStaffScreen> createState() => _EventStaffScreenState();
}

class _EventStaffScreenState extends State<EventStaffScreen> {
  final email = TextEditingController();
  final form = GlobalKey<FormState>();
  List<Map> staff = [];
  Map? candidate;
  bool busy = false, searched = false, failed = false;
  String get path =>
      '/api/organizer/events/${Uri.encodeComponent(widget.eventId)}/staff';
  String tr(String en, String ru, String kk) =>
      switch (AppLocalizations.of(context).locale.languageCode) {
        'ru' => ru,
        'kk' => kk,
        _ => en,
      };
  @override
  void initState() {
    super.initState();
    run();
  }

  @override
  void dispose() {
    email.dispose();
    super.dispose();
  }

  Future<void> run({String? method, String? id, bool find = false}) async {
    if (busy) return;
    setState(() {
      busy = true;
      searched = false;
      failed = false;
      candidate = null;
    });
    try {
      if (method != null) {
        await widget.api.request(method, path, body: {'userId': id});
      }
      final data = await widget.api.get(
        path,
        query: find ? {'email': email.text.trim()} : null,
      );
      if (!mounted) return;
      setState(() {
        staff = (data['staff'] as List).whereType<Map>().toList();
        candidate = data['candidate'] is Map ? data['candidate'] as Map : null;
        searched = find;
        if (method == 'POST') email.clear();
      });
    } catch (_) {
      if (mounted) setState(() => failed = true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> revoke(Map person) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          tr(
            'Revoke access?',
            'Отозвать доступ?',
            'Қолжетімділікті жою керек пе?',
          ),
        ),
        content: Text('${person['email']}'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(tr('Cancel', 'Отмена', 'Бас тарту')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(tr('Revoke', 'Отозвать', 'Жою')),
          ),
        ],
      ),
    );
    if (mounted && yes == true) {
      await run(method: 'DELETE', id: '${person['id']}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final found = candidate;
    final assigned = found != null && staff.any((p) => p['id'] == found['id']);
    return Scaffold(
      appBar: AppBar(
        title: Text(
          tr(
            'Event administrators',
            'Администраторы мероприятия',
            'Іс-шара әкімшілері',
          ),
        ),
        actions: [
          IconButton(
            onPressed: busy ? null : () => run(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            tr(
              'Manage scanner access for this event.',
              'Управление доступом к сканеру мероприятия.',
              'Іс-шара сканеріне қолжетімділікті басқару.',
            ),
          ),
          const SizedBox(height: 16),
          Form(
            key: form,
            child: TextFormField(
              controller: email,
              enabled: !busy,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                labelText: tr(
                  'Email address',
                  'Электронная почта',
                  'Электрондық пошта',
                ),
              ),
              validator: (v) => v == null || !v.trim().contains('@')
                  ? tr(
                      'Enter a valid email',
                      'Введите корректный email',
                      'Дұрыс email енгізіңіз',
                    )
                  : null,
              onChanged: (_) => setState(() {
                candidate = null;
                searched = false;
              }),
            ),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: busy
                ? null
                : () {
                    if (form.currentState!.validate()) run(find: true);
                  },
            child: Text(
              tr('Find user', 'Найти пользователя', 'Пайдаланушыны табу'),
            ),
          ),
          if (busy) const LinearProgressIndicator(),
          if (failed)
            Text(
              tr(
                'Request failed. Please retry.',
                'Ошибка запроса. Повторите попытку.',
                'Сұрау қатесі. Қайталап көріңіз.',
              ),
            ),
          if (searched && found == null)
            Text(
              tr(
                'No eligible user found.',
                'Подходящий пользователь не найден.',
                'Сәйкес пайдаланушы табылмады.',
              ),
            ),
          if (found != null)
            Card(
              child: ListTile(
                title: Text('${found['name']}'),
                subtitle: Text('${found['email']}'),
                trailing: TextButton(
                  onPressed: busy || assigned
                      ? null
                      : () => run(method: 'POST', id: '${found['id']}'),
                  child: Text(
                    assigned
                        ? tr('Assigned', 'Назначен', 'Тағайындалған')
                        : tr('Assign', 'Назначить', 'Тағайындау'),
                  ),
                ),
              ),
            ),
          const Divider(),
          if (!busy && !failed && staff.isEmpty)
            Text(
              tr(
                'No administrators assigned.',
                'Администраторы не назначены.',
                'Әкімшілер тағайындалмаған.',
              ),
            ),
          for (final person in staff)
            Card(
              child: ListTile(
                title: Text('${person['name']}'),
                subtitle: Text('${person['email']}'),
                trailing: IconButton(
                  tooltip: tr(
                    'Revoke access',
                    'Отозвать доступ',
                    'Қолжетімділікті жою',
                  ),
                  onPressed: busy ? null : () => revoke(person),
                  icon: const Icon(Icons.person_remove_outlined),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
