import 'package:flutter/material.dart';

/// Lockup Fintech Médias — même mapping que le site et le splash :
/// - mode clair → [logoLightAsset]
/// - mode sombre / fond sombre → [logoDarkAsset]
class EntrevueLogo extends StatelessWidget {
  const EntrevueLogo({
    super.key,
    this.height = 40,
    this.onDark,
    this.color,
  });

  final double height;

  /// Force le logo pour fond sombre (ex. hero kiosque, onboarding photo).
  /// Sinon : [color] (encre claire ⇒ fond sombre) ou le thème Material.
  final bool? onDark;

  /// Encre du parent (blanc sur fond sombre, navy sur fond clair).
  /// Conservé pour les appels existants ; préférer [onDark] ou le thème.
  final Color? color;

  static const logoLightAsset = 'assets/brand/logo-fintech-light.png';
  static const logoDarkAsset = 'assets/brand/logo-fintech.png';

  @override
  Widget build(BuildContext context) {
    final darkSurface = onDark ??
        (color != null
            ? color!.computeLuminance() >= 0.5
            : Theme.of(context).brightness == Brightness.dark);

    return Image.asset(
      darkSurface ? logoDarkAsset : logoLightAsset,
      height: height,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      semanticLabel: 'Fintech Médias',
    );
  }
}
