import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';

typedef EditorField = ({String key, String label, bool required, bool number});

class OrganizerEditor extends StatefulWidget {
  const OrganizerEditor({
    super.key,
    required this.title,
    required this.fields,
    required this.initial,
    required this.save,
  });

  final String title;
  final List<EditorField> fields;
  final Map<String, dynamic> initial;
  final Future<Object?> Function(Map<String, dynamic>) save;

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
  bool saving = false;
  String? error;

  @override
  void dispose() {
    for (final controller in controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    if (saving || !form.currentState!.validate()) return;
    final payload = Map<String, dynamic>.of(widget.initial);
    for (final field in widget.fields) {
      final value = controllers[field.key]!.text.trim();
      if (value.isEmpty && field.number) {
        payload.remove(field.key);
      } else {
        payload[field.key] = field.number ? int.parse(value) : value;
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

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !saving,
    child: Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Form(
        key: form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            for (final field in widget.fields)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextFormField(
                  controller: controllers[field.key],
                  enabled: !saving,
                  decoration: InputDecoration(labelText: field.label),
                  keyboardType: field.number ? TextInputType.number : null,
                  validator: (value) {
                    final input = value?.trim() ?? '';
                    if (input.isEmpty) {
                      return field.required ? 'Required' : null;
                    }
                    if (field.number && int.tryParse(input) == null) {
                      return 'Enter a whole number';
                    }
                    if ((field.key == 'startsAt' || field.key == 'endsAt') &&
                        DateTime.tryParse(input) == null) {
                      return 'Enter a date and time in ISO format';
                    }
                    return null;
                  },
                ),
              ),
            if (error != null) Text(error!),
            FilledButton(
              onPressed: saving ? null : submit,
              child: Text(saving ? 'Saving…' : 'Save'),
            ),
          ],
        ),
      ),
    ),
  );
}
