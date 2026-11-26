import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/uuid.dart';
import '../l10n/app_localizations.dart';
import 'order_status.dart';

/// Campaign QR codes are event links with a `c` token, not promo text.
String? campaignTokenFrom(String raw) {
  final value = raw.trim();
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return null;
  }
  final token = Uri.tryParse(value)?.queryParameters['c']?.trim();
  if (token == null || token.isEmpty) return null;
  return token;
}

class CheckoutLine {
  final String ticketTypeId;
  final String name;
  final int priceKzt;
  final int quantity;
  const CheckoutLine({
    required this.ticketTypeId,
    required this.name,
    required this.priceKzt,
    required this.quantity,
  });
}

class CheckoutScreen extends StatefulWidget {
  final ApiClient api;
  final String eventId;
  final String eventTitle;
  final List<CheckoutLine> lines;
  final String? initialName;
  final String? initialEmail;
  final String? initialCampaignToken;
  final String? initialPromoCode;

  const CheckoutScreen({
    super.key,
    required this.api,
    required this.eventId,
    required this.eventTitle,
    required this.lines,
    this.initialName,
    this.initialEmail,
    this.initialCampaignToken,
    this.initialPromoCode,
  });

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  late final TextEditingController _name;
  late final TextEditingController _email;
  final _promo = TextEditingController();
  final _idempotencyKey = randomUuid();
  String? _initialCampaignToken;
  int _promoRequest = 0;
  bool _previewing = false;
  int _discountKzt = 0;
  String? _promoLabel;
  String? _error;
  bool _pending = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.initialName ?? '');
    _email = TextEditingController(text: widget.initialEmail ?? '');
    final seeded = widget.initialCampaignToken?.trim();
    if (seeded != null && seeded.isNotEmpty) {
      _initialCampaignToken = campaignTokenFrom(seeded) ?? seeded;
    }
    _promo.text = widget.initialPromoCode?.trim() ?? '';
    if ((widget.initialName == null || widget.initialName!.isEmpty) ||
        (widget.initialEmail == null || widget.initialEmail!.isEmpty)) {
      _prefillFromMe();
    }
    if (_initialCampaignToken != null || _promo.text.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _applyPromo();
      });
    }
  }

  ({String? code, String? token}) _offer() {
    final raw = _promo.text.trim();
    final token = campaignTokenFrom(raw);
    if (token != null) return (code: null, token: token);
    if (raw.isEmpty) return (code: null, token: _initialCampaignToken);
    return (code: raw, token: null);
  }

  Future<void> _prefillFromMe() async {
    try {
      final data = await widget.api.get('/api/me');
      final user = data['user'];
      if (user is! Map || !mounted) return;
      if (_name.text.trim().isEmpty) {
        _name.text = '${user['name'] ?? ''}';
      }
      if (_email.text.trim().isEmpty) {
        _email.text = '${user['email'] ?? ''}';
      }
      setState(() {});
    } catch (_) {
      // Attendee can still type details manually.
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _promo.dispose();
    super.dispose();
  }

  int get _subtotal =>
      widget.lines.fold(0, (sum, line) => sum + line.priceKzt * line.quantity);

  int get _total => (_subtotal - _discountKzt).clamp(0, 1 << 30);

  int get _ticketCount =>
      widget.lines.fold(0, (sum, line) => sum + line.quantity);

  Future<void> _applyPromo() async {
    final request = ++_promoRequest;
    final offer = _offer();
    setState(() {
      _error = null;
      _promoLabel = null;
      _discountKzt = 0;
      _previewing = offer.code != null || offer.token != null;
    });
    if (!_previewing) return;
    try {
      final data = await widget.api.post('/api/promo/preview', {
        'eventId': widget.eventId,
        if (offer.code != null) 'code': offer.code,
        if (offer.token != null) 'campaignToken': offer.token,
        'items': [
          for (final line in widget.lines)
            {
              'ticketTypeId': line.ticketTypeId,
              'quantity': line.quantity,
              'unitPriceKzt': line.priceKzt,
            },
        ],
      });
      final totals = data['totals'];
      final campaign = data['campaign'];
      if (!mounted || request != _promoRequest) return;
      final l10n = AppLocalizations.of(context);
      setState(() {
        _discountKzt = totals is Map && totals['discountKzt'] is num
            ? (totals['discountKzt'] as num).toInt()
            : 0;
        _promoLabel = campaign is Map
            ? '${campaign['name'] ?? (offer.token != null ? l10n.campaignApplied : l10n.promoApplied)}'
            : (offer.token != null ? l10n.campaignApplied : l10n.promoApplied);
      });
    } on ApiException catch (error) {
      if (mounted && request == _promoRequest) {
        setState(() => _error = error.code);
      }
    } catch (_) {
      if (mounted && request == _promoRequest) {
        setState(() => _error = 'REQUEST_FAILED');
      }
    } finally {
      if (mounted && request == _promoRequest) {
        setState(() => _previewing = false);
      }
    }
  }

  Future<void> _submit() async {
    if (_pending || _previewing) return;
    final fullName = _name.text.trim();
    final email = _email.text.trim().toLowerCase();
    if (fullName.length < 2 || !email.contains('@')) {
      setState(() => _error = 'VALIDATION_FAILED');
      return;
    }
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      final attendees = List.generate(
        _ticketCount,
        (_) => {'fullName': fullName, 'email': email},
      );
      final offer = _offer();
      final created = await widget.api.post('/api/orders', {
        'eventId': widget.eventId,
        'items': [
          for (final line in widget.lines)
            {'ticketTypeId': line.ticketTypeId, 'quantity': line.quantity},
        ],
        'attendees': attendees,
        if (offer.code != null) 'promoCode': offer.code,
        if (offer.token != null) 'campaignToken': offer.token,
        'clientIdempotencyKey': _idempotencyKey,
      });
      final order = created['order'];
      if (order is! Map) {
        throw const ApiException(500, 'INVALID_ORDER_RESPONSE');
      }
      final orderId = '${order['id'] ?? ''}';
      if (orderId.isEmpty) {
        throw const ApiException(500, 'INVALID_ORDER_RESPONSE');
      }
      if (!mounted) return;
      await Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => OrderStatusScreen(api: widget.api, orderId: orderId),
        ),
      );
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.code);
    } catch (_) {
      if (mounted) setState(() => _error = 'REQUEST_FAILED');
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.checkout)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            widget.eventTitle,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 12),
          ...widget.lines.map(
            (line) => ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(l10n.ticketTypeName(line.name)),
              subtitle: Text('× ${line.quantity}'),
              trailing: Text(l10n.money(line.priceKzt * line.quantity)),
            ),
          ),
          const Divider(),
          TextField(
            controller: _name,
            decoration: InputDecoration(labelText: l10n.fullName),
            textCapitalization: TextCapitalization.words,
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _email,
            decoration: InputDecoration(labelText: l10n.email),
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _promo,
                  enabled: !_pending,
                  decoration: InputDecoration(labelText: l10n.promoOrCampaign),
                  onChanged: (_) {
                    _promoRequest++;
                    setState(() {
                      _initialCampaignToken = null;
                      _discountKzt = 0;
                      _promoLabel = null;
                      _previewing = false;
                      _error = null;
                    });
                  },
                ),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: _pending || _previewing ? null : _applyPromo,
                child: Text(_previewing ? l10n.working : l10n.apply),
              ),
            ],
          ),
          if (_promoLabel != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_promoLabel!),
            ),
          const SizedBox(height: 16),
          if (_discountKzt > 0) Text(l10n.discount(_discountKzt)),
          Text(
            l10n.total(l10n.money(_total)),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                l10n.apiError(_error!),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          const SizedBox(height: 16),
          if (_total > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                l10n.simulatedPayment,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          FilledButton(
            onPressed: _pending || _previewing ? null : _submit,
            child: Text(_pending ? l10n.working : l10n.placeOrder),
          ),
        ],
      ),
    );
  }
}
