import 'package:flutter/material.dart';
import '../../core/constants.dart';

/// Palette des écrans compte, alignée sur le thème clair / sombre.
class AccountPalette {
  const AccountPalette._({
    required this.bg,
    required this.fg,
    required this.muted,
    required this.group,
    required this.divider,
    required this.iconBg,
  });

  factory AccountPalette.of(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return dark
        ? const AccountPalette._(
            bg: Color(kBrandBlack),
            fg: Color(0xFFF2F4F7),
            muted: Color(0xFF9AA3B2),
            group: Color(0xFF1C1C1E),
            divider: Color(0xFF2C2C2E),
            iconBg: Color(0xFF2C2C2E),
          )
        : const AccountPalette._(
            bg: Color(0xFFF5F5F7),
            fg: Color(kBrandBlack),
            muted: Color(0xFF6B6B6B),
            group: Colors.white,
            divider: Color(0xFFECECEF),
            iconBg: Color(0xFFF2F2F4),
          );
  }

  final Color bg;
  final Color fg;
  final Color muted;
  final Color group;
  final Color divider;
  final Color iconBg;
}
