import 'package:material_ui/material_ui.dart';

import '../theme/biletflow_theme.dart';

class BrandMark extends StatelessWidget {
  const BrandMark({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: BiletFlowColors.brand,
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Align(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _MarkLine(14),
                SizedBox(height: 3),
                _MarkLine(9),
                SizedBox(height: 3),
                _MarkLine(11),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        const Text.rich(
          TextSpan(
            text: 'Bilet',
            children: [
              TextSpan(
                text: 'Flow',
                style: TextStyle(color: BiletFlowColors.brand),
              ),
            ],
          ),
          semanticsLabel: 'BiletFlow',
          style: TextStyle(
            color: BiletFlowColors.ink900,
            fontSize: 21,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.6,
          ),
        ),
      ],
    );
  }
}

class _MarkLine extends StatelessWidget {
  const _MarkLine(this.width);
  final double width;

  @override
  Widget build(BuildContext context) => Container(
    height: 2,
    width: width,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(2),
    ),
  );
}
