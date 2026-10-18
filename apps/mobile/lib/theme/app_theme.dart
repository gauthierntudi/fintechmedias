import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/constants.dart';

class AppTheme {
  static const navy = Color(kBrandNavy);
  static const gold = Color(kBrandGold);
  static const red = Color(kBrandRed);
  static const blue = Color(kBrandBlue);

  /// Identité typo Fintech Médias — corps et titres.
  static const sans = 'FamiljenGrotesk';
  static const display = 'FamiljenGrotesk';

  /// Status bar adaptée au mode clair / sombre.
  static SystemUiOverlayStyle statusBarForMode(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    return SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: dark ? Brightness.light : Brightness.dark,
      statusBarBrightness: dark ? Brightness.dark : Brightness.light,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness:
          dark ? Brightness.light : Brightness.dark,
      systemNavigationBarContrastEnforced: false,
    );
  }

  /// Icônes status bar blanches (lecture article, fonds sombres).
  static const statusBarLightIcons = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.light,
    systemNavigationBarContrastEnforced: false,
  );

  static TextStyle displayText({
    double size = 22,
    FontWeight weight = FontWeight.w700,
    double height = 1.2,
    Color? color,
    double letterSpacing = -0.2,
  }) {
    return TextStyle(
      fontFamily: display,
      fontFamilyFallback: const [sans],
      fontSize: size,
      fontWeight: weight,
      height: height,
      color: color,
      letterSpacing: letterSpacing,
    );
  }

  static TextStyle sansText({
    double size = 16,
    FontWeight weight = FontWeight.w400,
    double height = 1.5,
    Color? color,
    double letterSpacing = 0,
  }) {
    return TextStyle(
      fontFamily: sans,
      fontSize: size,
      fontWeight: weight,
      height: height,
      color: color,
      letterSpacing: letterSpacing,
    );
  }

  /// Titre d’article (lecture) — Google Sans Bold.
  static TextStyle articleTitleText({
    double size = 28,
    FontWeight weight = FontWeight.w700,
    double height = 1.2,
    Color? color,
    double letterSpacing = -0.2,
  }) {
    final bold =
        weight.value >= FontWeight.w700.value ? weight : FontWeight.w700;
    return GoogleFonts.googleSans(
      fontSize: size,
      fontWeight: bold,
      height: height,
      color: color,
      letterSpacing: letterSpacing,
    );
  }

  /// Chapô + corps d’article (lecture) — Google Sans.
  static TextStyle articleBodyText({
    double size = 16,
    FontWeight weight = FontWeight.w400,
    double height = 1.55,
    Color? color,
    double letterSpacing = 0,
    FontStyle? fontStyle,
    TextStyle? textStyle,
  }) {
    return GoogleFonts.googleSans(
      textStyle: textStyle,
      fontSize: size,
      fontWeight: weight,
      height: height,
      color: color,
      letterSpacing: letterSpacing,
      fontStyle: fontStyle,
    );
  }

  /// Précharge Google Sans (lecture article).
  static Future<void> preloadArticleFonts() {
    GoogleFonts.googleSans();
    GoogleFonts.googleSans(fontWeight: FontWeight.w700);
    GoogleFonts.googleSans(fontStyle: FontStyle.italic);
    return GoogleFonts.pendingFonts();
  }

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: navy,
      brightness: Brightness.light,
      primary: navy,
      secondary: gold,
      error: red,
    );
    return _theme(scheme, Colors.white, navy);
  }

  static ThemeData dark() {
    const ink = Color(0xFFF2F4F7);
    final scheme = ColorScheme.fromSeed(
      seedColor: navy,
      brightness: Brightness.dark,
      primary: gold,
      secondary: gold,
      surface: const Color(0xFF1A1A1A),
      error: red,
    );
    return _theme(scheme, navy, ink);
  }

  static ThemeData _theme(
    ColorScheme scheme,
    Color scaffold,
    Color appBarForeground,
  ) {
    final text = _textTheme(
      ThemeData(brightness: scheme.brightness).textTheme,
      scheme.onSurface,
    );
    return ThemeData(
      useMaterial3: true,
      fontFamily: sans,
      colorScheme: scheme,
      scaffoldBackgroundColor: scaffold,
      textTheme: text,
      primaryTextTheme: text,
      appBarTheme: AppBarTheme(
        backgroundColor: scaffold,
        foregroundColor: appBarForeground,
        elevation: 0,
        centerTitle: true,
        systemOverlayStyle: statusBarForMode(scheme.brightness),
        titleTextStyle: displayText(
          size: 18,
          weight: FontWeight.w700,
          color: appBarForeground,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return sansText(
            size: 12,
            weight: selected ? FontWeight.w700 : FontWeight.w500,
            height: 1.2,
          );
        }),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        selectedItemColor: scheme.brightness == Brightness.dark ? gold : navy,
        unselectedItemColor: scheme.brightness == Brightness.dark
            ? const Color(0xFF9AA3B2)
            : const Color(0xFF6B6B6B),
        selectedLabelStyle: sansText(size: 12, weight: FontWeight.w700),
        unselectedLabelStyle: sansText(size: 12, weight: FontWeight.w500),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          textStyle: sansText(size: 16, weight: FontWeight.w700, height: 1.2),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          textStyle: sansText(size: 14, weight: FontWeight.w600, height: 1.2),
        ),
      ),
      chipTheme: ChipThemeData(
        labelStyle: sansText(size: 13, weight: FontWeight.w700, height: 1.2),
      ),
    );
  }

  static TextTheme _textTheme(TextTheme base, Color onSurface) {
    TextStyle headline(double size, FontWeight weight, double height) {
      return displayText(
        size: size,
        weight: weight,
        height: height,
        color: onSurface,
      );
    }

    TextStyle body(double size, FontWeight weight, double height) {
      return sansText(
        size: size,
        weight: weight,
        height: height,
        color: onSurface,
      );
    }

    return base.copyWith(
      displayLarge: headline(32, FontWeight.w700, 1.15),
      displayMedium: headline(28, FontWeight.w700, 1.15),
      displaySmall: headline(24, FontWeight.w700, 1.2),
      headlineLarge: headline(26, FontWeight.w700, 1.2),
      headlineMedium: headline(22, FontWeight.w700, 1.2),
      headlineSmall: headline(18, FontWeight.w700, 1.25),
      titleLarge: headline(17, FontWeight.w700, 1.25),
      titleMedium: body(15, FontWeight.w600, 1.35),
      titleSmall: body(13, FontWeight.w600, 1.3),
      bodyLarge: body(16, FontWeight.w400, 1.5),
      bodyMedium: body(14, FontWeight.w400, 1.45),
      bodySmall: body(12, FontWeight.w400, 1.4),
      labelLarge: body(14, FontWeight.w600, 1.2),
      labelMedium: body(12, FontWeight.w600, 1.2),
      labelSmall: body(11, FontWeight.w700, 1.2).copyWith(
        letterSpacing: 0.35,
      ),
    );
  }

  static Color toneColor(String? tone) {
    switch (tone) {
      case 'red':
        return red;
      case 'blue':
        return blue;
      case 'gold':
        return gold;
      case 'teal':
        return navy;
      case 'dark':
        return red;
      default:
        return red;
    }
  }
}
