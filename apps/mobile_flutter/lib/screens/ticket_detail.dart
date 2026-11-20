import 'dart:io';
import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';

class TicketDetailScreen extends StatefulWidget {
  final ApiClient api;
  final String ticketId;
  final Map<String, dynamic> summary;

  const TicketDetailScreen({
    super.key,
    required this.api,
    required this.ticketId,
    required this.summary,
  });

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  Uint8List? _qr;
  String? _qrError;
  bool _qrLoading = true;
  bool _pdfBusy = false;

  @override
  void initState() {
    super.initState();
    _loadQr();
  }

  bool get _canShowQr {
    final status = '${widget.summary['status'] ?? ''}';
    return status == 'VALID' || status == 'CHECKED_IN';
  }

  Future<void> _loadQr() async {
    if (!_canShowQr) {
      setState(() {
        _qrLoading = false;
        _qrError = null;
      });
      return;
    }
    setState(() {
      _qrLoading = true;
      _qrError = null;
    });
    try {
      final bytes = await widget.api.getBytes(
        '/api/tickets/${widget.ticketId}/qr.png',
        accept: 'image/png',
      );
      setState(() => _qr = Uint8List.fromList(bytes));
    } on ApiException catch (error) {
      setState(() => _qrError = error.code);
    } catch (_) {
      setState(() => _qrError = 'REQUEST_FAILED');
    } finally {
      if (mounted) setState(() => _qrLoading = false);
    }
  }

  Future<void> _sharePdf() async {
    setState(() => _pdfBusy = true);
    try {
      final bytes = await widget.api.getBytes(
        '/api/tickets/${widget.ticketId}/pdf',
        accept: 'application/pdf',
      );
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/biletflow-ticket-${widget.ticketId}.pdf');
      await file.writeAsBytes(bytes, flush: true);
      await Share.shareXFiles(
        [XFile(file.path, mimeType: 'application/pdf')],
        subject: 'BiletFlow ticket',
      );
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.code)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to open PDF')),
        );
      }
    } finally {
      if (mounted) setState(() => _pdfBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final summary = widget.summary;
    final event = summary['event'];
    final title = event is Map ? '${event['title'] ?? 'Ticket'}' : 'Ticket';
    final when = event is Map ? '${event['startsAt'] ?? ''}' : '';
    final status = '${summary['status'] ?? ''}';

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text('${summary['ticketTypeName'] ?? ''}'),
          Text('${summary['attendeeName'] ?? ''}'),
          if (when.isNotEmpty) Text(when),
          Text('Status: $status'),
          const SizedBox(height: 20),
          Text('Admission QR', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (!_canShowQr)
            Text(
              status == 'REFUNDED' || status == 'CANCELLED'
                  ? 'This ticket is not valid for entry.'
                  : 'QR is unavailable for this ticket status.',
            )
          else if (_qrLoading)
            const Center(child: CircularProgressIndicator())
          else if (_qrError != null)
            Text(_qrError!, style: TextStyle(color: Theme.of(context).colorScheme.error))
          else if (_qr != null)
            Center(
              child: Image.memory(
                _qr!,
                width: 240,
                height: 240,
                fit: BoxFit.contain,
                gaplessPlayback: true,
              ),
            ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _pdfBusy ? null : _sharePdf,
            icon: const Icon(Icons.picture_as_pdf),
            label: Text(_pdfBusy ? 'Preparing PDF…' : 'Share / save PDF'),
          ),
          const SizedBox(height: 8),
          Text(
            'QR and PDF come from the server with your bearer token. The token is never put in the image URL.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
