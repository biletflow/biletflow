import 'dart:io';
import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../l10n/app_localizations.dart';

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
        final l10n = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.apiError(error.code))),
        );
      }
    } catch (_) {
      if (mounted) {
        final l10n = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.pdfFailed)),
        );
      }
    } finally {
      if (mounted) setState(() => _pdfBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
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
          Text(l10n.status(l10n.ticketStatus(status))),
          const SizedBox(height: 20),
          Text(l10n.admissionQr, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (!_canShowQr)
            Text(
              status == 'REFUNDED' || status == 'CANCELLED'
                  ? l10n.ticketInvalid
                  : l10n.qrUnavailable,
            )
          else if (_qrLoading)
            const Center(child: CircularProgressIndicator())
          else if (_qrError != null)
            Text(
              l10n.apiError(_qrError!),
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            )
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
            label: Text(_pdfBusy ? l10n.preparingPdf : l10n.sharePdf),
          ),
          const SizedBox(height: 8),
          Text(l10n.qrNote, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
