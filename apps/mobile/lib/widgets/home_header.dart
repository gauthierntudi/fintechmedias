import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';
import 'studrc_logo.dart';

/// En-tête de l’accueil (style « grand titre ») :
/// - ligne d’actions : menu « … » à gauche, notifications + « + » (publier
///   un statut) à droite ;
/// - logo Fintech Médias en grand, aligné à gauche ;
/// - champ de recherche (ouvre l’écran Recherche).
class FintechHomeHeader extends StatelessWidget {
  const FintechHomeHeader({
    super.key,
    required this.onMenu,
    required this.onNotify,
    required this.onAddStatus,
    required this.onSearch,
  });

  final VoidCallback onMenu;
  final VoidCallback onNotify;
  final VoidCallback onAddStatus;
  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ink = dark ? Colors.white : AppTheme.navy;
    final chip = dark ? const Color(0xFF1F1F1F) : const Color(0xFFF0F0F0);
    final chipBorder = dark ? const Color(0xFF2C2C2C) : const Color(0xFFE4E4E4);
    final muted = dark ? const Color(0xFF8E8E93) : const Color(0xFF7A7A7A);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              _RoundButton(
                tooltip: 'Menu',
                background: chip,
                border: chipBorder,
                onTap: onMenu,
                child: Icon(LucideIcons.ellipsis, size: 22, color: ink),
              ),
              const Spacer(),
              _RoundButton(
                tooltip: 'Notifications',
                background: chip,
                border: chipBorder,
                onTap: onNotify,
                child: Icon(LucideIcons.bell, size: 20, color: ink),
              ),
              const SizedBox(width: 10),
              _RoundButton(
                tooltip: 'Publier un statut',
                background: AppTheme.gold,
                onTap: onAddStatus,
                child: const Icon(
                  LucideIcons.plus,
                  size: 24,
                  color: Color(0xFF0B0B0B),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerLeft,
            child: FintechLogo(height: 34, onDark: dark),
          ),
          const SizedBox(height: 14),
          Semantics(
            button: true,
            label: 'Rechercher',
            child: Material(
              color: chip,
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                onTap: onSearch,
                borderRadius: BorderRadius.circular(14),
                child: SizedBox(
                  height: 44,
                  child: Row(
                    children: [
                      const SizedBox(width: 12),
                      Icon(LucideIcons.search, size: 19, color: muted),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Rechercher un article, une rubrique…',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTheme.sansText(
                            size: 16,
                            height: 1.2,
                            color: muted,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.tooltip,
    required this.background,
    required this.onTap,
    required this.child,
    this.border,
  });

  final String tooltip;
  final Color background;
  final Color? border;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: background,
        shape: CircleBorder(
          side: border == null
              ? BorderSide.none
              : BorderSide(color: border!, width: 0.8),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: SizedBox(width: 44, height: 44, child: Center(child: child)),
        ),
      ),
    );
  }
}
