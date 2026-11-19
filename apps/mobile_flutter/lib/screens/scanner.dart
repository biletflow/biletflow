import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/api.dart';
import '../core/session.dart';

class ScannerScreen extends StatefulWidget {
  final Session session;

  const ScannerScreen({super.key, required this.session});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen>
    with WidgetsBindingObserver {
  final camera = MobileScannerController(
    autoStart: false,
    formats: [BarcodeFormat.qrCode],
  );
  final search = TextEditingController();
  List<Map<String, dynamic>>? events;
  String? eventId;
  Map<String, dynamic>? stats;
  List<Map<String, dynamic>>? attendees;
  Map<String, dynamic>? result;
  String? error;
  bool busy = false;
  bool scanning = false;
  bool starting = false;
  bool stopping = false;

  ApiClient get api => widget.session.api;
  bool get locked => busy || scanning || starting || stopping;
  String get eventPath => '/api/mobile/events/${Uri.encodeComponent(eventId!)}';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(loadEvents());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    search.dispose();
    unawaited(camera.dispose());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed &&
        (state != AppLifecycleState.inactive || !starting)) {
      unawaited(stopCamera());
    }
  }

  Future<void> stopCamera() async {
    if (!scanning) return;
    setState(() {
      scanning = false;
      stopping = true;
    });
    try {
      await camera.stop();
    } catch (_) {
      if (mounted) setState(() => error = 'Could not stop the camera.');
    } finally {
      if (mounted) setState(() => stopping = false);
    }
  }

  Future<void> run(Future<void> Function() action) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
    } on ApiException catch (failure) {
      if (!mounted) return;
      if (failure.status == 401 || failure.status == 403) {
        try {
          await widget.session.refresh();
        } on ApiException catch (sessionFailure) {
          if (sessionFailure.status == 401 || sessionFailure.status == 403) {
            if (!mounted) return;
            final session = widget.session;
            unawaited(session.logout());
            Navigator.of(context).pop();
            return;
          }
        } catch (_) {
          // Keep the original authorization error visible.
        }
        if (!mounted) return;
        setState(() {
          eventId = null;
          events = null;
          stats = null;
          attendees = null;
          result = null;
        });
      }
      setState(
        () => error = switch (failure.status) {
          401 || 403 => 'Access changed. Reload your available events.',
          404 => 'This event or check-in is no longer available.',
          409 => 'This check-in has already changed. Search again.',
          429 => 'Too many requests. Wait a moment and retry.',
          >= 500 => 'The server could not complete the request. Retry.',
          _ => 'Request rejected: ${failure.code}',
        },
      );
    } on TimeoutException {
      if (mounted) {
        setState(
          () => error = 'Request timed out. Check the connection and retry.',
        );
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => error =
              'Could not complete the request. Check the connection and retry.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  List<Map<String, dynamic>> readList(Map<String, dynamic> data, String key) =>
      (data[key] as List).cast<Map<String, dynamic>>();

  Future<void> loadEvents() => run(() async {
    final data = await api.get('/api/mobile/events?scope=authorized');
    if (mounted) setState(() => events = readList(data, 'events'));
  });

  Future<void> refreshStats() async {
    final data = await api.get('$eventPath/stats');
    if (mounted) setState(() => stats = data);
  }

  Future<void> selectEvent(String? id) async {
    setState(() {
      eventId = id;
      stats = null;
      result = null;
      attendees = null;
      search.clear();
    });
    if (id != null) await run(refreshStats);
  }

  Future<void> start() async {
    if (locked || eventId == null) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      starting = true;
      scanning = true;
      result = null;
      error = null;
    });
    try {
      await camera.start();
      if (!mounted) return;
      final failure = camera.value.error;
      if (failure != null) {
        setState(() {
          scanning = false;
          error = failure.errorCode == MobileScannerErrorCode.permissionDenied
              ? 'Camera access is denied. Allow BiletFlow to use the camera in your phone settings, then retry.'
              : 'Could not open the camera. Close other camera apps and retry.';
        });
      } else if (!scanning ||
          WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed ||
          ModalRoute.of(context)?.isCurrent != true) {
        await camera.stop();
        if (mounted) setState(() => scanning = false);
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          scanning = false;
          error = 'Could not open the camera. Retry.';
        });
      }
    } finally {
      if (mounted) setState(() => starting = false);
    }
  }

  void detected(BarcodeCapture capture) {
    final selected = eventId;
    if (busy ||
        starting ||
        !scanning ||
        selected == null ||
        ModalRoute.of(context)?.isCurrent != true ||
        WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed) {
      return;
    }
    for (final barcode in capture.barcodes) {
      final payload = barcode.rawValue;
      if (payload == null || payload.isEmpty) continue;
      unawaited(
        run(() async {
          setState(() => scanning = false);
          await camera.stop();
          if (!mounted) return;
          final data = await api.post('/api/checkin', {
            'eventId': selected,
            'payload': payload,
          });
          if (!mounted) return;
          if (data['result'] is! String || data['message'] is! String) {
            throw const FormatException('Invalid check-in response');
          }
          setState(() {
            result = data;
            attendees = null;
          stats = null;
          });
          await refreshStats();
        }),
      );
      break;
    }
  }

  Future<void> findAttendees() async {
    if (locked || eventId == null) return;
    await run(() async {
      final query = search.text.trim();
      if (query.isEmpty) {
        setState(() => attendees = null);
        return;
      }
      final data = await api.get(
        '$eventPath/attendees?q=${Uri.encodeQueryComponent(query)}',
      );
      if (mounted) setState(() => attendees = readList(data, 'attendees'));
    });
  }

  Future<void> reverse(String recordId) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => const _ReverseDialog(),
    );
    if (reason == null || !mounted) return;
    await run(() async {
      final data = await api.post('/api/checkin/reverse', {
        'checkInRecordId': recordId,
        'reason': reason,
      });
      if (!mounted) return;
      if (data['reversed'] != true) {
        throw const FormatException('Invalid reversal response');
      }
      setState(() {
        result = null;
        attendees = null;
        stats = null;
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Check-in reversed')));
      await refreshStats();
    });
  }

  String eventLabel(Map<String, dynamic> event) {
    final date = DateTime.tryParse('${event['startsAt']}')?.toLocal();
    final label = event['title'] as String;
    if (date == null) return label;
    final strings = MaterialLocalizations.of(context);
    return '$label · ${strings.formatMediumDate(date)}';
  }

  Widget resultCard(Map<String, dynamic> data) {
    final colors = Theme.of(context).colorScheme;
    final valid = data['result'] == 'VALID';
    final ticket = data['ticket'];
    return Card(
      color: valid ? colors.primaryContainer : colors.errorContainer,
      child: ListTile(
        leading: Icon(valid ? Icons.check_circle : Icons.cancel),
        title: Text('${data['result']} · ${data['message']}'),
        subtitle: ticket is Map
            ? Text(
                [
                  ticket['attendeeName'],
                  ticket['ticketTypeName'],
                  ticket['seatLabel'],
                ].whereType<String>().join(' · '),
              )
            : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('QR scanner')),
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (events == null)
            OutlinedButton(
              onPressed: busy ? null : loadEvents,
              child: const Text('Load available events'),
            )
          else if (events!.isEmpty)
            const Text('No events are available for scanning.')
          else
            DropdownButton<String>(
              isExpanded: true,
              hint: const Text('Select an event'),
              value: eventId,
              onChanged: locked ? null : selectEvent,
              items: [
                for (final event in events!)
                  DropdownMenuItem(
                    value: event['id'] as String,
                    child: Text(
                      eventLabel(event),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
            ),
          if (stats case final counts?)
            Text(
              'Checked in: ${counts['checkedIn']} / ${counts['registered']}',
            ),
          if (busy) const LinearProgressIndicator(),
          if (error case final message?)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                message,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          if (result case final data?) resultCard(data),
          Offstage(
            offstage: !scanning,
            child: AspectRatio(
              aspectRatio: 1,
              child: MobileScanner(controller: camera, onDetect: detected),
            ),
          ),
          if (eventId != null) ...[
            FilledButton(
              onPressed: scanning
                  ? (starting ? null : stopCamera)
                  : (locked ? null : start),
              child: Text(scanning ? 'Stop camera' : 'Scan ticket'),
            ),
            if (stats == null)
              TextButton(
                onPressed: locked ? null : () => run(refreshStats),
                child: const Text('Refresh attendance'),
              ),
            const SizedBox(height: 12),
            TextField(
              controller: search,
              enabled: !locked,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => findAttendees(),
              decoration: InputDecoration(
                labelText: 'Name, email or order reference',
                suffixIcon: IconButton(
                  onPressed: locked ? null : findAttendees,
                  tooltip: 'Search attendees',
                  icon: const Icon(Icons.search),
                ),
              ),
            ),
            if (attendees case final rows?)
              if (rows.isEmpty)
                const ListTile(title: Text('No matching attendees'))
              else
                for (final attendee in rows)
                  ListTile(
                    title: Text('${attendee['attendeeName']}'),
                    subtitle: Text(
                      '${attendee['ticketTypeName']} · ${attendee['status']}',
                    ),
                    trailing: attendee['checkInRecordId'] is String
                        ? TextButton(
                            onPressed: locked
                                ? null
                                : () => reverse(
                                    attendee['checkInRecordId'] as String,
                                  ),
                            child: const Text('Reverse'),
                          )
                        : null,
                  ),
          ],
        ],
      ),
    ),
  );
}

class _ReverseDialog extends StatefulWidget {
  const _ReverseDialog();

  @override
  State<_ReverseDialog> createState() => _ReverseDialogState();
}

class _ReverseDialogState extends State<_ReverseDialog> {
  final form = GlobalKey<FormState>();
  final reason = TextEditingController();

  @override
  void dispose() {
    reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Reverse check-in?'),
    content: Form(
      key: form,
      child: TextFormField(
        controller: reason,
        autofocus: true,
        maxLength: 500,
        decoration: const InputDecoration(labelText: 'Reason'),
        validator: (value) => (value ?? '').trim().length < 3
            ? 'Enter at least 3 characters.'
            : null,
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () {
          if (form.currentState!.validate()) {
            Navigator.pop(context, reason.text.trim());
          }
        },
        child: const Text('Reverse check-in'),
      ),
    ],
  );
}
