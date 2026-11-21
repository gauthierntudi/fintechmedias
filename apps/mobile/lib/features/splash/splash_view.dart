import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_theme.dart';
import '../../widgets/studrc_logo.dart';

/// Miroir du splash natif — même fond + logo, taille modérée (pas de 2e « flash » géant).
class SplashView extends StatelessWidget {
  const SplashView({super.key});

  @override
  Widget build(BuildContext context) {
    final dark = MediaQuery.platformBrightnessOf(context) == Brightness.dark;
    final background = dark ? AppTheme.navy : Colors.white;
    final overlay =
        dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: overlay,
      child: ColoredBox(
        color: background,
        child: Center(
          child: FintechLogo(
            // Aligné sur le splash natif (wordmark contenu, pas plein écran).
            height: 56,
            onDark: dark,
          ),
        ),
      ),
    );
  }
}
