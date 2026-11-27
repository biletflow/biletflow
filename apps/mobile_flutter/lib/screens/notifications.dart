import 'package:material_ui/material_ui.dart';

import '../core/api.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<List<Map<String, dynamic>>> notifications = load();

  String label(String en, String ru, String kk) {
    return switch (Localizations.localeOf(context).languageCode) {
      'ru' => ru,
      'kk' => kk,
      _ => en,
    };
  }

  Future<List<Map<String, dynamic>>> load() async {
    final data = await widget.api.get('/api/notifications');
    return (data['notifications'] as List? ?? []).whereType<Map<String, dynamic>>().toList();
  }

  Future<void> markRead(String id) async {
    try {
      await widget.api.post('/api/notifications/${Uri.encodeComponent(id)}/read', {});
      if (mounted) setState(() => notifications = load());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(label('Could not mark notification as read', 'Не удалось отметить уведомление прочитанным', 'Хабарламаны оқылған деп белгілеу мүмкін болмады'))));
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(label('Notifications', 'Уведомления', 'Хабарламалар')),
      actions: [IconButton(onPressed: () => setState(() => notifications = load()), icon: const Icon(Icons.refresh))],
    ),
    body: FutureBuilder<List<Map<String, dynamic>>>(
      future: notifications,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError) return Center(child: Text(label('Could not load notifications', 'Не удалось загрузить уведомления', 'Хабарламаларды жүктеу мүмкін болмады')));
        final rows = snapshot.data ?? const [];
        if (rows.isEmpty) return Center(child: Text(label('No notifications', 'Нет уведомлений', 'Хабарлама жоқ')));
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: rows.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final row = rows[index];
            final read = row['readAt'] != null;
            return Card(
              child: ListTile(
                leading: Icon(read ? Icons.notifications_none : Icons.notifications_active),
                title: Text('${row['subject'] ?? ''}'),
                subtitle: Text([ '${row['body'] ?? ''}', if (DateTime.tryParse('${row['createdAt']}') case final date?) MaterialLocalizations.of(context).formatMediumDate(date.toLocal()) + ' ' + MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(date.toLocal())), ].join('\n')),
                isThreeLine: true,
                onTap: read ? null : () => markRead('${row['id']}'),
              ),
            );
          },
        );
      },
    ),
  );
}
