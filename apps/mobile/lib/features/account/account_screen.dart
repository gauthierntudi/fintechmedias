import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../core/google_auth.dart';
import '../../core/models.dart';
import '../../core/theme_mode.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_shell.dart';
import '../../widgets/google_sign_in_button.dart';
import '../../widgets/masonry_backdrop.dart';
import '../../widgets/studrc_logo.dart';
import 'account_palette.dart';
import 'editable_avatar.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider);
    if (user == null) {
      return const Scaffold(body: _SignedOut());
    }
    return Scaffold(body: _SignedIn(user: user));
  }
}

class _SignedOut extends ConsumerStatefulWidget {
  const _SignedOut();

  @override
  ConsumerState<_SignedOut> createState() => _SignedOutState();
}

class _SignedOutState extends ConsumerState<_SignedOut> {
  var _busy = false;
  String? _error;

  Future<void> _submitGoogle() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final settings = ref.read(appSettingsProvider).valueOrNull;
      final credential = await GoogleAuth.idToken(settings);
      if (!mounted) return;
      await ref.read(sessionProvider.notifier).loginWithGoogle(credential);
    } on GoogleSignInCanceled {
      return;
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = ref.read(apiClientProvider).apiError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const ink = Colors.white;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: AppTheme.statusBarLightIcons,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const MasonryBackdrop(backgroundColor: Color(0xFF111111)),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x66111111),
                  Color(0xCC111111),
                  Color(0xF8111111),
                ],
                stops: [0, 0.45, 1],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              child: Column(
                children: [
                  const FintechLogo(height: 34, onDark: true),
                  const Spacer(),
                  Text(
                    'Votre espace Fintech Médias',
                    textAlign: TextAlign.center,
                    style: AppTheme.displayText(
                      size: 24,
                      weight: FontWeight.w800,
                      color: ink,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Connectez-vous pour vos achats, notifications et la lecture des magazines.',
                    textAlign: TextAlign.center,
                    style: AppTheme.sansText(
                      size: 15,
                      height: 1.45,
                      color: ink.withValues(alpha: 0.78),
                    ),
                  ),
                  const SizedBox(height: 28),
                  AuthPrimaryButton(
                    label: 'Se connecter',
                    borderRadius: 0,
                    busy: _busy,
                    onPressed: _busy ? null : () => context.push('/connexion'),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: OutlinedButton(
                      onPressed:
                          _busy ? null : () => context.push('/inscription'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: ink,
                        side: BorderSide(color: ink.withValues(alpha: 0.45)),
                        shape: const RoundedRectangleBorder(
                          borderRadius: BorderRadius.zero,
                        ),
                      ),
                      child: Text(
                        'Créer un compte',
                        style: AppTheme.sansText(
                          size: 16,
                          weight: FontWeight.w700,
                          color: ink,
                        ),
                      ),
                    ),
                  ),
                  Theme(
                    data: Theme.of(context).copyWith(
                      colorScheme: Theme.of(context).colorScheme.copyWith(
                        surface: Colors.white,
                        onSurface: AppTheme.navy,
                        outline: Colors.white,
                      ),
                    ),
                    child: GoogleSignInButton(
                      busy: _busy,
                      borderRadius: 0,
                      dividerLabel: 'Ou',
                      onPressed: _submitGoogle,
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    AuthErrorBanner(_error!),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

final _unreadCountProvider = FutureProvider.autoDispose<int>((ref) {
  return ref.watch(apiClientProvider).unreadCount();
});

const _kAppVersion = '1.0.0';
const _kContactEmail = 'contact@fintechmedias.com';
const _danger = Color(0xFFE5484D);

class _SignedIn extends ConsumerWidget {
  const _SignedIn({required this.user});

  final Subscriber user;

  Future<void> _open(BuildContext context, Uri uri) async {
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Impossible d’ouvrir le lien')),
      );
    }
  }

  Future<void> _pickTheme(BuildContext context, WidgetRef ref) async {
    final p = AccountPalette.of(context);
    final mode = await showModalBottomSheet<ThemeMode>(
      context: context,
      useRootNavigator: true,
      backgroundColor: p.group,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _ThemeSheet(
        palette: p,
        current: ref.read(themeModeProvider),
      ),
    );
    if (mode != null) await ref.read(themeModeProvider.notifier).set(mode);
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final p = AccountPalette.of(context);
    final ok = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      backgroundColor: p.group,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _LogoutSheet(palette: p),
    );
    if (ok == true) await ref.read(sessionProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = AccountPalette.of(context);
    final unread = ref.watch(_unreadCountProvider).valueOrNull ?? 0;
    final themeMode = ref.watch(themeModeProvider);

    return ColoredBox(
      color: p.bg,
      child: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppTheme.gold,
          onRefresh: () async {
            ref.invalidate(_unreadCountProvider);
            await ref.read(sessionProvider.notifier).refreshMe();
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Mon compte',
                      style: AppTheme.displayText(
                        size: 30,
                        weight: FontWeight.w800,
                        color: p.fg,
                        letterSpacing: -0.6,
                      ),
                    ),
                  ),
                  _MoreMenu(
                    palette: p,
                    unread: unread,
                    onNotifications: () async {
                      await context.push('/notifications');
                      ref.invalidate(_unreadCountProvider);
                    },
                    onStatuses: () => context.push('/mes-statuts'),
                    onPurchases: () => context.push('/achats'),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              _IdentityCard(
                user: user,
                palette: p,
                onEdit: () => context.push('/profil'),
              ),
              const SizedBox(height: 28),
              _SectionLabel('Mon espace', palette: p),
              _Group(
                palette: p,
                children: [
                  _Row(
                    palette: p,
                    icon: LucideIcons.userRound,
                    title: 'Informations personnelles',
                    subtitle: 'Nom, e-mail et téléphone',
                    onTap: () => context.push('/profil'),
                  ),
                  _Row(
                    palette: p,
                    icon: LucideIcons.bell,
                    title: 'Notifications',
                    subtitle: unread > 0
                        ? '$unread non lue${unread > 1 ? 's' : ''}'
                        : 'Vous êtes à jour',
                    badge: unread,
                    onTap: () async {
                      await context.push('/notifications');
                      ref.invalidate(_unreadCountProvider);
                    },
                  ),
                  _Row(
                    palette: p,
                    icon: LucideIcons.shoppingBag,
                    title: 'Mes achats',
                    subtitle: 'Magazines et accès achetés',
                    onTap: () => context.push('/achats'),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              _SectionLabel('Préférences', palette: p),
              _Group(
                palette: p,
                children: [
                  _Row(
                    palette: p,
                    icon: switch (themeMode) {
                      ThemeMode.light => LucideIcons.sun,
                      ThemeMode.dark => LucideIcons.moon,
                      ThemeMode.system => LucideIcons.sunMoon,
                    },
                    title: 'Thème',
                    value: themeModeLabel(themeMode),
                    onTap: () => _pickTheme(context, ref),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              _SectionLabel('Assistance', palette: p),
              _Group(
                palette: p,
                children: [
                  _Row(
                    palette: p,
                    icon: LucideIcons.mail,
                    title: 'Nous contacter',
                    subtitle: _kContactEmail,
                    trailingIcon: LucideIcons.arrowUpRight,
                    onTap: () => _open(
                      context,
                      Uri(scheme: 'mailto', path: _kContactEmail),
                    ),
                  ),
                  _Row(
                    palette: p,
                    icon: LucideIcons.info,
                    title: 'Qui sommes-nous',
                    trailingIcon: LucideIcons.arrowUpRight,
                    onTap: () => _open(
                      context,
                      Uri.parse('$kSiteUrl/qui-sommes-nous'),
                    ),
                  ),
                  _Row(
                    palette: p,
                    icon: LucideIcons.shieldCheck,
                    title: 'Confidentialité',
                    trailingIcon: LucideIcons.arrowUpRight,
                    onTap: () => _open(
                      context,
                      Uri.parse('$kSiteUrl/confidentialite'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              SizedBox(
                height: 52,
                child: OutlinedButton.icon(
                  onPressed: () => _confirmLogout(context, ref),
                  icon: const Icon(LucideIcons.logOut, size: 18),
                  label: Text(
                    'Se déconnecter',
                    style: AppTheme.sansText(
                      size: 16,
                      weight: FontWeight.w700,
                      color: _danger,
                      height: 1.2,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _danger,
                    backgroundColor: p.group,
                    side: BorderSide(color: _danger.withValues(alpha: 0.55)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                '$kMagazineName · v$_kAppVersion',
                textAlign: TextAlign.center,
                style: AppTheme.sansText(size: 12, color: p.muted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({
    required this.user,
    required this.palette,
    required this.onEdit,
  });

  final Subscriber user;
  final AccountPalette palette;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      decoration: BoxDecoration(
        color: p.group,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              EditableAvatar(user: user, size: 76),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.name.isEmpty ? 'Mon profil' : user.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.displayText(
                        size: 21,
                        weight: FontWeight.w800,
                        color: p.fg,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            user.email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTheme.sansText(
                              size: 14,
                              color: p.muted,
                              height: 1.3,
                            ),
                          ),
                        ),
                        if (user.emailVerified) ...[
                          const SizedBox(width: 6),
                          const Icon(
                            LucideIcons.badgeCheck,
                            size: 16,
                            color: AppTheme.gold,
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 44,
            child: FilledButton.icon(
              onPressed: onEdit,
              icon: const Icon(LucideIcons.pencil, size: 16),
              label: Text(
                'Modifier le profil',
                style: AppTheme.sansText(
                  size: 15,
                  weight: FontWeight.w700,
                  height: 1.2,
                  color: p.group,
                ),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: p.fg,
                foregroundColor: p.group,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label, {required this.palette});

  final String label;
  final AccountPalette palette;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 10),
      child: Text(
        label.toUpperCase(),
        style: AppTheme.sansText(
          size: 12,
          weight: FontWeight.w700,
          color: palette.muted,
          letterSpacing: 0.9,
          height: 1.2,
        ),
      ),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.palette, required this.children});

  final AccountPalette palette;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final items = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) {
        items.add(
          Padding(
            padding: const EdgeInsets.only(left: 66),
            child: Divider(height: 1, thickness: 1, color: palette.divider),
          ),
        );
      }
      items.add(children[i]);
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: Material(
        color: palette.group,
        child: Column(children: items),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.palette,
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.value,
    this.badge = 0,
    this.trailingIcon = LucideIcons.chevronRight,
  });

  final AccountPalette palette;
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? value;
  final int badge;
  final IconData trailingIcon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: p.iconBg,
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(icon, size: 19, color: p.fg),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTheme.sansText(
                      size: 16,
                      weight: FontWeight.w600,
                      color: p.fg,
                      height: 1.25,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.sansText(
                        size: 13,
                        color: p.muted,
                        height: 1.3,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (value != null) ...[
              Text(
                value!,
                style: AppTheme.sansText(size: 14, color: p.muted, height: 1.2),
              ),
              const SizedBox(width: 6),
            ],
            if (badge > 0) ...[
              Container(
                constraints: const BoxConstraints(minWidth: 22),
                height: 22,
                padding: const EdgeInsets.symmetric(horizontal: 7),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppTheme.gold,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Text(
                  badge > 99 ? '99+' : '$badge',
                  style: AppTheme.sansText(
                    size: 12,
                    weight: FontWeight.w800,
                    color: const Color(kBrandBlack),
                    height: 1,
                  ),
                ),
              ),
              const SizedBox(width: 8),
            ],
            Icon(trailingIcon, size: 18, color: p.muted),
          ],
        ),
      ),
    );
  }
}

class _LogoutSheet extends StatelessWidget {
  const _LogoutSheet({required this.palette});

  final AccountPalette palette;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: p.muted.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Se déconnecter ?',
              style: AppTheme.displayText(
                size: 21,
                weight: FontWeight.w800,
                color: p.fg,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Vous devrez vous reconnecter pour accéder à vos achats et notifications.',
              textAlign: TextAlign.center,
              style: AppTheme.sansText(size: 15, color: p.muted, height: 1.45),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton(
                onPressed: () => Navigator.pop(context, true),
                style: FilledButton.styleFrom(
                  backgroundColor: _danger,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  'Se déconnecter',
                  style: AppTheme.sansText(
                    size: 16,
                    weight: FontWeight.w700,
                    height: 1.2,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: TextButton(
                onPressed: () => Navigator.pop(context, false),
                style: TextButton.styleFrom(
                  foregroundColor: p.fg,
                  backgroundColor: p.iconBg,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  'Annuler',
                  style: AppTheme.sansText(
                    size: 16,
                    weight: FontWeight.w700,
                    height: 1.2,
                    color: p.fg,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThemeSheet extends StatelessWidget {
  const _ThemeSheet({required this.palette, required this.current});

  final AccountPalette palette;
  final ThemeMode current;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    const options = [
      (ThemeMode.system, LucideIcons.sunMoon, 'Suit le réglage de l’appareil'),
      (ThemeMode.light, LucideIcons.sun, 'Fond clair en permanence'),
      (ThemeMode.dark, LucideIcons.moon, 'Fond sombre en permanence'),
    ];
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: p.muted.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Thème de l’app',
              textAlign: TextAlign.center,
              style: AppTheme.displayText(
                size: 20,
                weight: FontWeight.w800,
                color: p.fg,
              ),
            ),
            const SizedBox(height: 18),
            for (final (mode, icon, hint) in options) ...[
              _ThemeOption(
                palette: p,
                icon: icon,
                title: themeModeLabel(mode),
                subtitle: hint,
                selected: mode == current,
                onTap: () => Navigator.pop(context, mode),
              ),
              const SizedBox(height: 10),
            ],
          ],
        ),
      ),
    );
  }
}

class _ThemeOption extends StatelessWidget {
  const _ThemeOption({
    required this.palette,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final AccountPalette palette;
  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return Material(
      color: p.iconBg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: selected ? AppTheme.gold : Colors.transparent,
          width: 1.5,
        ),
      ),
      child: InkWell(
        customBorder: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Icon(icon, size: 22, color: p.fg),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTheme.sansText(
                        size: 16,
                        weight: FontWeight.w600,
                        color: p.fg,
                        height: 1.25,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: AppTheme.sansText(
                        size: 13,
                        color: p.muted,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                selected ? LucideIcons.circleCheck : LucideIcons.circle,
                size: 22,
                color: selected ? AppTheme.gold : p.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum _MoreAction { notifications, statuses, purchases }

/// Bouton « ⋮ » du header : raccourcis Notifications, Mes statuts, Mes achats.
class _MoreMenu extends StatelessWidget {
  const _MoreMenu({
    required this.palette,
    required this.unread,
    required this.onNotifications,
    required this.onStatuses,
    required this.onPurchases,
  });

  final AccountPalette palette;
  final int unread;
  final VoidCallback onNotifications;
  final VoidCallback onStatuses;
  final VoidCallback onPurchases;

  PopupMenuItem<_MoreAction> _item(
    _MoreAction value,
    IconData icon,
    String label, {
    int badge = 0,
  }) {
    final p = palette;
    return PopupMenuItem<_MoreAction>(
      value: value,
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: p.iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: p.fg),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: AppTheme.sansText(
                size: 15,
                weight: FontWeight.w600,
                color: p.fg,
              ),
            ),
          ),
          if (badge > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: AppTheme.gold,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                badge > 99 ? '99+' : '$badge',
                style: AppTheme.sansText(
                  size: 12,
                  weight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return PopupMenuButton<_MoreAction>(
      tooltip: 'Plus d’options',
      position: PopupMenuPosition.under,
      offset: const Offset(0, 8),
      color: p.group,
      surfaceTintColor: Colors.transparent,
      elevation: 8,
      shadowColor: Colors.black.withValues(alpha: 0.25),
      constraints: const BoxConstraints(minWidth: 230),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: p.divider),
      ),
      onOpened: HapticFeedback.selectionClick,
      onSelected: (action) {
        switch (action) {
          case _MoreAction.notifications:
            onNotifications();
          case _MoreAction.statuses:
            onStatuses();
          case _MoreAction.purchases:
            onPurchases();
        }
      },
      itemBuilder: (_) => [
        _item(_MoreAction.notifications, LucideIcons.bell, 'Notifications',
            badge: unread),
        _item(_MoreAction.statuses, LucideIcons.circleDashed, 'Mes statuts'),
        _item(_MoreAction.purchases, LucideIcons.shoppingBag, 'Mes achats'),
      ],
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: p.group,
              shape: BoxShape.circle,
            ),
            child: Icon(LucideIcons.ellipsis, size: 22, color: p.fg),
          ),
          if (unread > 0)
            Positioned(
              top: 2,
              right: 2,
              child: Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: AppTheme.gold,
                  shape: BoxShape.circle,
                  border: Border.all(color: p.bg, width: 2),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
