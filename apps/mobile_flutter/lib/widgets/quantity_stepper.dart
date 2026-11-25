import 'package:material_ui/material_ui.dart';

import '../l10n/app_localizations.dart';
import '../theme/biletflow_theme.dart';

class QuantityStepper extends StatelessWidget {
  final int value;
  final int max;
  final ValueChanged<int> onChanged;
  const QuantityStepper({
    super.key,
    required this.value,
    required this.max,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final cappedMax = max < 0 ? 0 : max;
    final l10n = AppLocalizations.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: l10n.decrease,
          onPressed: value <= 0 ? null : () => onChanged(value - 1),
          icon: const Icon(Icons.remove_circle_outline),
          color: BiletFlowColors.brand,
        ),
        SizedBox(
          width: 28,
          child: Text(
            '$value',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        IconButton(
          tooltip: l10n.increase,
          onPressed: value >= cappedMax ? null : () => onChanged(value + 1),
          icon: const Icon(Icons.add_circle_outline),
          color: BiletFlowColors.brand,
        ),
      ],
    );
  }
}
