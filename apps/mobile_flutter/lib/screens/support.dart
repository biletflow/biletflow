import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../widgets/empty_state.dart';

const _casesPath = '/api/support/cases';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  late var cases = widget.api.get(_casesPath);

  void reload() => setState(() => cases = widget.api.get(_casesPath));

  Future<void> openCase(String id) async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => SupportThread(api: widget.api, id: id),
      ),
    );
    if (mounted) reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Support')),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('New request'),
        onPressed: () async {
          final id = await Navigator.push<String>(
            context,
            MaterialPageRoute(builder: (_) => SupportComposer(api: widget.api)),
          );
          if (mounted && id != null) await openCase(id);
        },
      ),
      body: FutureBuilder(
        future: cases,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingState();
          }
          final rows = snapshot.data?['cases'];
          if (snapshot.hasError || rows is! List) {
            return ErrorState(
              message: _error(context, snapshot.error),
              onRetry: reload,
            );
          }
          if (rows.isEmpty) {
            return const EmptyState(title: 'No support requests');
          }
          return ListView(
            padding: const EdgeInsets.only(bottom: 88),
            children: [
              for (final row in rows.whereType<Map<String, dynamic>>())
                ListTile(
                  title: Text('${row['subject']}'),
                  subtitle: Text('${row['reference']} · ${row['status']}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => openCase(row['id'] as String),
                ),
            ],
          );
        },
      ),
    );
  }
}

class SupportComposer extends StatefulWidget {
  const SupportComposer({super.key, required this.api, this.orderId});
  final ApiClient api;
  final String? orderId;

  @override
  State<SupportComposer> createState() => _SupportComposerState();
}

class _SupportComposerState extends State<SupportComposer> {
  final form = GlobalKey<FormState>();
  final subject = TextEditingController();
  final body = TextEditingController();
  bool saving = false;
  String? error;

  @override
  void dispose() {
    subject.dispose();
    body.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (saving || !form.currentState!.validate()) return;
    setState(() {
      saving = true;
      error = null;
    });
    try {
      final result = await widget.api.post(_casesPath, {
        'category': widget.orderId == null ? 'TECHNICAL' : 'REFUND',
        'subject': subject.text.trim(),
        'body': body.text.trim(),
        if (widget.orderId != null) 'orderId': widget.orderId,
      });
      final id = (result['case'] as Map)['id'] as String;
      if (mounted) Navigator.pop(context, id);
    } catch (failure) {
      if (mounted) setState(() => error = _error(context, failure));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final refund = widget.orderId != null;
    return PopScope(
      canPop: !saving,
      child: Scaffold(
        appBar: AppBar(
          title: Text(refund ? 'Refund request' : 'New support request'),
        ),
        body: Form(
          key: form,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                controller: subject,
                decoration: const InputDecoration(labelText: 'Subject'),
                maxLength: 200,
                validator: _threeCharacters,
              ),
              TextFormField(
                controller: body,
                decoration: const InputDecoration(labelText: 'Message'),
                minLines: 3,
                maxLines: 8,
                maxLength: 5000,
                validator: _threeCharacters,
              ),
              if (error != null) Text(error!),
              FilledButton(
                onPressed: saving ? null : submit,
                child: Text(saving ? 'Sending…' : 'Send request'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String? _threeCharacters(String? value) =>
    (value?.trim().length ?? 0) < 3 ? 'Enter at least three characters' : null;

class SupportThread extends StatefulWidget {
  const SupportThread({super.key, required this.api, required this.id});
  final ApiClient api;
  final String id;

  @override
  State<SupportThread> createState() => _SupportThreadState();
}

class _SupportThreadState extends State<SupportThread> {
  final reply = TextEditingController();
  String get path => '$_casesPath/${Uri.encodeComponent(widget.id)}';
  late var thread = widget.api.get(path);
  bool sending = false;
  String? error;

  void reload() => setState(() => thread = widget.api.get(path));

  @override
  void dispose() {
    reply.dispose();
    super.dispose();
  }

  Future<void> send() async {
    final body = reply.text.trim();
    if (body.isEmpty || sending) return;
    setState(() {
      sending = true;
      error = null;
    });
    try {
      final updated = await widget.api.post('$path/messages', {'body': body});
      if (!mounted) return;
      reply.clear();
      setState(() => thread = Future.value(updated));
    } catch (failure) {
      if (mounted) setState(() => error = _error(context, failure));
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Support conversation'),
      actions: [
        IconButton(
          onPressed: sending ? null : reload,
          icon: const Icon(Icons.refresh),
          tooltip: 'Refresh',
        ),
      ],
    ),
    body: FutureBuilder(
      future: thread,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingState();
        }
        final record = snapshot.data?['case'];
        if (snapshot.hasError || record is! Map) {
          return ErrorState(
            message: _error(context, snapshot.error),
            onRetry: reload,
          );
        }
        final messages = record['messages'] as List? ?? const [];
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              '${record['subject']}',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            Text('${record['reference']} · ${record['status']}'),
            for (final message in messages.whereType<Map>())
              ListTile(
                title: Text('${message['body']}'),
                subtitle: Text(
                  '${(message['author'] as Map?)?['name'] ?? 'Support'}',
                ),
              ),
            if (record['status'] != 'RESOLVED') ...[
              TextField(
                controller: reply,
                enabled: !sending,
                maxLength: 5000,
                decoration: const InputDecoration(labelText: 'Reply'),
              ),
              if (error != null) Text(error!),
              FilledButton(
                onPressed: sending ? null : send,
                child: const Text('Send reply'),
              ),
            ],
          ],
        );
      },
    ),
  );
}

String _error(BuildContext context, Object? failure) =>
    AppLocalizations.of(context)
        .apiError(failure is ApiException ? failure.code : '');
