import 'package:flutter/material.dart';

/// Official ENTREVUE lockup. [color] only chooses white vs black artwork.
class EntrevueLogo extends StatelessWidget {
  const EntrevueLogo({
    super.key,
    this.height = 40,
    this.color = Colors.white,
  });

  final double height;
  final Color color;

  static const _whiteAsset = 'assets/brand/logo-Lentrevue-blanc.png';
  static const _blackAsset = 'assets/brand/logo-Lentrevue-mail.png';

  @override
  Widget build(BuildContext context) {
    final onDark = color.computeLuminance() >= 0.5;
    return Image.asset(
      onDark ? _whiteAsset : _blackAsset,
      height: height,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      semanticLabel: 'ENTREVUE',
    );
  }
}
