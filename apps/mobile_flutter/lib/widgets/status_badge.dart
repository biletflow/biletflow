import 'package:material_ui/material_ui.dart';

import '../theme/biletflow_theme.dart';

class StatusBadge extends StatelessWidget {
  final String label;
  final StatusTone tone;
  const StatusBadge({super.key, required this.label, this.tone = StatusTone.neutral});

  factory StatusBadge.ticket(String status, String label) {
    return StatusBadge(label: label, tone: toneForTicket(status));
  }

  factory StatusBadge.order(String status, String label) {
    return StatusBadge(label: label, tone: toneForOrder(status));
  }

  static StatusTone toneForTicket(String status) {
    switch (status) {
      case 'VALID':
        return StatusTone.success;
      case 'CHECKED_IN':
        return StatusTone.info;
      case 'CANCELLED':
      case 'REFUNDED':
        return StatusTone.danger;
      default:
        return StatusTone.neutral;
    }
  }

  static StatusTone toneForOrder(String status) {
    switch (status) {
      case 'PAID':
        return StatusTone.success;
      case 'AWAITING_PAYMENT':
      case 'PENDING':
        return StatusTone.warning;
      case 'CANCELLED':
      case 'EXPIRED':
      case 'FAILED':
        return StatusTone.danger;
      default:
        return StatusTone.neutral;
    }
  }

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      StatusTone.success => (BiletFlowColors.successBg, BiletFlowColors.success),
      StatusTone.warning => (BiletFlowColors.warningBg, const Color(0xff92400e)),
      StatusTone.danger => (BiletFlowColors.errorBg, BiletFlowColors.error),
      StatusTone.info => (BiletFlowColors.infoBg, BiletFlowColors.info),
      StatusTone.neutral => (BiletFlowColors.ink100, BiletFlowColors.ink700),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: fg,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

enum StatusTone { success, warning, danger, info, neutral }
