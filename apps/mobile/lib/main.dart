import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:media_kit/media_kit.dart';
import 'app.dart';
import 'core/onboarding.dart';
import 'core/theme_mode.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  final binding = WidgetsFlutterBinding.ensureInitialized();
  // Garde le splash natif jusqu’au 1er frame Flutter (pas de 2e splash UI).
  FlutterNativeSplash.preserve(widgetsBinding: binding);

  OnboardingController onboarding;
  var themeMode = ThemeMode.system;
  try {
    await initializeDateFormatting('fr');
    onboarding = await OnboardingController.load().timeout(
      const Duration(seconds: 3),
    );
    themeMode = await ThemeModeController.loadInitial().timeout(
      const Duration(seconds: 2),
    );
  } catch (e, st) {
    debugPrint('Bootstrap prefs/locale failed: $e\n$st');
    onboarding = OnboardingController(false);
  }

  try {
    MediaKit.ensureInitialized();
  } catch (e, st) {
    debugPrint('MediaKit.ensureInitialized failed: $e\n$st');
  }

  // Fonts lecture article (non bloquant si le réseau est lent).
  unawaited(() async {
    try {
      await AppTheme.preloadArticleFonts();
    } catch (e, st) {
      debugPrint('Article fonts preload failed: $e\n$st');
    }
  }());

  runApp(
    ProviderScope(
      overrides: [
        onboardingProvider.overrideWith((ref) => onboarding),
        themeModeProvider.overrideWith((ref) => ThemeModeController(themeMode)),
      ],
      child: const FintechApp(),
    ),
  );
  // FlutterNativeSplash.remove() est appelé depuis app.dart après le 1er frame.
}
