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
    await widget.api.request('PATCH', '/api/notifications', body: {'id': id});
    if (mounted) setState(() => notifications = load());
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
                subtitle: Text('${row['body'] ?? ''}'),
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
