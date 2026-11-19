import 'package:material_ui/material_ui.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../core/api.dart';

class ScannerScreen extends StatefulWidget {
  final ApiClient api;
  const ScannerScreen({super.key, required this.api});
  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final eventId = TextEditingController();
  final camera = MobileScannerController(autoStart: false, formats: [BarcodeFormat.qrCode]);
  bool busy = false, scanning = false;
  String? result;
  @override
  void dispose() { eventId.dispose(); camera.dispose(); super.dispose(); }

  Future<void> start() async {
    if (eventId.text.trim().isEmpty) return;
    setState(() { scanning = true; result = null; });
    try { await camera.start(); } catch (e) { if (mounted) setState(() { scanning = false; result = '$e'; }); }
  }

  Future<void> detected(BarcodeCapture capture) async {
    if (busy || !scanning) return;
    final codes = capture.barcodes;
    if (codes.isEmpty || codes.first.rawValue == null) return;
    setState(() { busy = true; scanning = false; });
    try {
      await camera.stop();
      final data = await widget.api.post('/api/checkin', {'eventId': eventId.text.trim(), 'payload': codes.first.rawValue!});
      final value = data['result'];
      final status = value is Map ? value['result'] : value;
      final message = value is Map ? value['message'] : data['message'];
      if (mounted) setState(() => result = '${status ?? 'UNKNOWN_RESPONSE'}\n${message ?? ''}');
    } catch (e) { if (mounted) setState(() => result = '$e'); }
    finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('QR scanner')), body: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
    TextField(controller: eventId, enabled: !scanning && !busy, decoration: const InputDecoration(labelText: 'Event ID', helperText: 'Development build: enter an authorized event ID')),
    const SizedBox(height: 12),
    Expanded(child: MobileScanner(controller: camera, onDetect: detected)),
    const SizedBox(height: 12),
    if (result != null) Text(result!, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
    FilledButton(onPressed: busy || scanning ? null : start, child: Text(busy ? 'Checking...' : scanning ? 'Scanning...' : 'Start / scan next ticket')),
  ])));
}
