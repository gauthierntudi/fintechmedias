import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const kThemeModeKey = 'theme_mode';

/// Thème choisi par l'utilisateur (Automatique = suit le système).
class ThemeModeController extends StateNotifier<ThemeMode> {
  ThemeModeController(super.initial, [this._prefs]);

  final SharedPreferences? _prefs;

  static ThemeMode parse(String? raw) => switch (raw) {
    'light' => ThemeMode.light,
    'dark' => ThemeMode.dark,
    _ => ThemeMode.system,
  };

  static Future<ThemeMode> loadInitial() async {
    final prefs = await SharedPreferences.getInstance();
    return parse(prefs.getString(kThemeModeKey));
  }

  Future<void> set(ThemeMode mode) async {
    if (mode == state) return;
    state = mode;
    final prefs = _prefs ?? await SharedPreferences.getInstance();
    await prefs.setString(kThemeModeKey, mode.name);
  }
}

/// Surchargé dans `main()` avec la valeur persistée.
final themeModeProvider = StateNotifierProvider<ThemeModeController, ThemeMode>(
  (ref) {
    return ThemeModeController(ThemeMode.system);
  },
);

String themeModeLabel(ThemeMode mode) => switch (mode) {
  ThemeMode.light => 'Clair',
  ThemeMode.dark => 'Sombre',
  ThemeMode.system => 'Automatique',
};
