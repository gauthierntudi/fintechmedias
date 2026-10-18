import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/constants.dart';
import '../../theme/app_theme.dart';
import '../../widgets/studrc_logo.dart';

class SplashView extends StatelessWidget {
  const SplashView({super.key});

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final bottom = MediaQuery.paddingOf(context).bottom;
    final dark = MediaQuery.platformBrightnessOf(context) == Brightness.dark;
    final logoWidth = (size.width * 0.72).clamp(240.0, 320.0);

    final background = dark ? AppTheme.navy : Colors.white;
    final sloganColor = dark
        ? Colors.white.withValues(alpha: 0.78)
        : AppTheme.navy.withValues(alpha: 0.72);
    final overlay =
        dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: overlay,
      child: ColoredBox(
        color: background,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Center(
              child: SizedBox(
                width: logoWidth,
                child: EntrevueLogo(
                  height: logoWidth * 0.36,
                  onDark: dark,
                ),
              ),
            ),
            Positioned(
              left: 32,
              right: 32,
              bottom: 28 + bottom,
              child: Text(
                kBrandTagline,
                textAlign: TextAlign.center,
                style: AppTheme.sansText(
                  size: 14,
                  weight: FontWeight.w500,
                  height: 1.35,
                  color: sloganColor,
                ).copyWith(
                  decoration: TextDecoration.none,
                  decorationColor: Colors.transparent,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
